/**
 * Agent Core
 *
 * The main AI agent that takes a user message + current project state,
 * calls Claude with tools, executes tool calls in a loop, and streams
 * results back.
 *
 * Architecture:
 * 1. Build system prompt with current project context
 * 2. Initialize MCP servers and merge their tools with built-in tools
 * 3. Send messages to Claude with extended thinking enabled
 * 4. If Claude calls tools, route to built-in or MCP executor
 * 5. Repeat until Claude responds with text only (no more tool calls)
 * 6. Stream text responses, thinking, and project updates back to the caller
 * 7. Track stats and yield a summary on completion
 *
 * Features:
 * - Extended thinking (budget_tokens: 10000)
 * - MCP server tool integration
 * - Adaptive rate limiting with 429 retry
 * - Code-generated summary stats (not LLM-generated)
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ContentBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";

import type { VideoProject } from "@/lib/schema/video-schema";
import { buildSystemPrompt } from "@/agent/prompts/system-prompt";
import { agentTools } from "@/agent/tools/tool-definitions";
import { executeToolCall } from "@/agent/tools/tool-executor";
import { RateLimiter } from "@/agent/rate-limiter";
import { MCPManager } from "@/agent/mcp/mcp-manager";
import type { AgentSummary } from "@/stores/chat-store";

// ─── Types ──────────────────────────────────────────────────────────

export interface AgentEvent {
  type:
    | "thinking"
    | "text"
    | "tool_call"
    | "tool_result"
    | "project_update"
    | "rate_limit"
    | "error"
    | "paused"
    | "done";
  /** Thinking text (for thinking events) */
  text?: string;
  /** Tool name (for tool_call events) */
  toolName?: string;
  /** Tool call ID (for tool_call events) */
  toolCallId?: string;
  /** Tool result message (for tool_result events) */
  toolResult?: string;
  /** Updated project (for project_update events) */
  project?: VideoProject;
  /** Error message (for error events) */
  error?: string;
  /** Tool call source (for tool_call events) */
  source?: "builtin" | "mcp";
  /** MCP server name (for mcp tool_call events) */
  mcpServer?: string;
  /** Rate limit wait time in ms (for rate_limit events) */
  waitMs?: number;
  /** Rate limit remaining capacity (for rate_limit events) */
  remaining?: { requests: number; tokens: number };
  /** Agent run summary (for done events) */
  summary?: AgentSummary;
  /** Track count (for project_update) */
  trackCount?: number;
  /** Clip count (for project_update) */
  clipCount?: number;
  /** Serialized conversation messages for continuation (for paused events) */
  continuationMessages?: MessageParam[];
}

export interface AgentRunOptions {
  /** The user's message */
  userMessage: string;
  /** The current VideoProject state */
  project: VideoProject;
  /** Previous conversation messages (for context) */
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Maximum number of tool-calling iterations */
  maxIterations?: number;
  /** Serialized conversation state from a paused agent run (for continuation) */
  continuationMessages?: MessageParam[];
  /** Override API key (from user provider config) */
  apiKey?: string;
  /** Override model ID */
  model?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const MAX_ITERATIONS = 10;
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 16000;
const THINKING_BUDGET = 10000;
const MAX_API_ERROR_RETRIES = 2;

// ─── Thinking Support Detection ─────────────────────────────────────

/**
 * Determines if a model supports Anthropic extended thinking.
 * Only Claude 4 (Opus/Sonnet) and Claude 3.7 Sonnet support it.
 * Haiku, older Sonnets (3.5), and non-Anthropic models do not.
 */
function modelSupportsThinking(modelId: string): boolean {
  // Claude 4 family (opus, sonnet) — any date suffix
  if (/^claude-.*-(opus|sonnet)-4/.test(modelId)) return true;
  // Claude 3.7 Sonnet
  if (/^claude-3-7-sonnet/.test(modelId)) return true;
  return false;
}

// ─── Agent Runner ───────────────────────────────────────────────────

/**
 * Runs the AI agent and yields events as they happen.
 * This is an async generator that the API route can stream from.
 */
export async function* runAgent(
  options: AgentRunOptions
): AsyncGenerator<AgentEvent> {
  const {
    userMessage,
    project: initialProject,
    conversationHistory = [],
    maxIterations = MAX_ITERATIONS,
    continuationMessages,
    apiKey: overrideApiKey,
    model: overrideModel,
  } = options;

  const apiKey = overrideApiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield {
      type: "error",
      error:
        "No API key configured. Add an Anthropic API key in Settings or set ANTHROPIC_API_KEY in your .env file.",
    };
    yield { type: "done" };
    return;
  }

  const modelId = overrideModel ?? MODEL;
  const client = new Anthropic({ apiKey });
  const rateLimiter = new RateLimiter();

  // ─── Initialize MCP ─────────────────────────────────────────────
  const mcpManager = MCPManager.getInstance();
  try {
    await mcpManager.initialize();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown MCP error";
    console.warn(`[Agent] MCP initialization failed: ${msg}`);
    // Continue without MCP — non-fatal
  }

  // Merge built-in tools with MCP tools
  const mcpTools = mcpManager.getAllTools();
  const allTools = [...agentTools, ...mcpTools];

  // ─── Stats tracking ─────────────────────────────────────────────
  const startTime = Date.now();
  let totalIterations = 0;
  const toolCallStats: Array<{ name: string; success: boolean; source: string }> = [];
  const mcpServersUsed = new Set<string>();
  let thinkingTokens = 0;
  let outputTokens = 0;
  let inputTokens = 0;
  let projectModified = false;

  // Track the evolving project state as tools modify it
  let currentProject = initialProject;

  // Build conversation messages — use continuation state if resuming
  const messages: MessageParam[] = continuationMessages
    ? [...continuationMessages]
    : [
        // Include conversation history
        ...conversationHistory.map(
          (msg) =>
            ({
              role: msg.role,
              content: msg.content,
            }) as MessageParam
        ),
        // Add the new user message
        {
          role: "user",
          content: userMessage,
        },
      ];

  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    totalIterations = iteration;

    // ─── Rate limit check ───────────────────────────────────────
    const systemPromptText = buildSystemPrompt(currentProject);
    const estimatedTokens = rateLimiter.estimateTokens(
      systemPromptText + JSON.stringify(messages)
    );

    const rateLimitCheck = rateLimiter.checkBeforeRequest(estimatedTokens);
    if (rateLimitCheck) {
      yield {
        type: "rate_limit",
        waitMs: rateLimitCheck.waitMs,
        remaining: rateLimitCheck.remaining,
      };
      await rateLimiter.wait(rateLimitCheck.waitMs);
    }

    // ─── Call Claude with retries ───────────────────────────────
    let response: Anthropic.Message;
    let retryAttempt = 0;
    let useThinking = modelSupportsThinking(modelId);

    while (true) {
      try {
        // Build request params — only include thinking for supported models
        const requestParams = {
          model: modelId,
          max_tokens: MAX_TOKENS,
          system: systemPromptText,
          tools: allTools,
          messages,
          ...(useThinking
            ? {
                thinking: {
                  type: "enabled" as const,
                  budget_tokens: THINKING_BUDGET,
                },
              }
            : {}),
        };

        const rawResponse = await client.messages
          .create(requestParams)
          .withResponse();

        response = rawResponse.data;

        // Update rate limiter from response headers
        rateLimiter.updateFromHeaders(rawResponse.response.headers);

        // Track token usage
        if (response.usage) {
          inputTokens += response.usage.input_tokens;
          outputTokens += response.usage.output_tokens;
          // cache_read_input_tokens and thinking tokens if available
          const usage = response.usage as unknown as Record<string, number>;
          if (usage.thinking_tokens) {
            thinkingTokens += usage.thinking_tokens;
          }
        }

        break; // Success — exit retry loop
      } catch (err: unknown) {
        // Handle 429 rate limit errors with retry
        if (
          err instanceof Anthropic.RateLimitError &&
          retryAttempt < rateLimiter.maxRetries
        ) {
          const headers = (err as unknown as { headers?: Headers }).headers;
          const retryAfter = headers?.get?.("retry-after") ?? null;
          const backoffMs = rateLimiter.getBackoffMs(retryAttempt, retryAfter);

          yield {
            type: "rate_limit",
            waitMs: backoffMs,
            remaining: { requests: 0, tokens: 0 },
          };

          await rateLimiter.wait(backoffMs);
          retryAttempt++;
          continue;
        }

        // Handle 500 API errors with retry (up to MAX_API_ERROR_RETRIES)
        if (
          err instanceof Anthropic.APIError &&
          err.status === 500 &&
          retryAttempt < MAX_API_ERROR_RETRIES
        ) {
          const backoffMs = rateLimiter.getBackoffMs(retryAttempt);
          console.warn(
            `[Agent] 500 API error, retry ${retryAttempt + 1}/${MAX_API_ERROR_RETRIES}` +
              (useThinking ? " (thinking enabled)" : ""),
            err.message
          );

          yield {
            type: "rate_limit",
            waitMs: backoffMs,
            remaining: { requests: 0, tokens: 0 },
          };

          await rateLimiter.wait(backoffMs);
          retryAttempt++;
          continue;
        }

        // Last resort: if we got a 500 with thinking on, retry once without thinking
        if (
          err instanceof Anthropic.APIError &&
          err.status === 500 &&
          useThinking
        ) {
          console.warn(
            "[Agent] 500 after retries with thinking — retrying without thinking as fallback"
          );
          useThinking = false;
          retryAttempt = 0; // Reset retries for the non-thinking attempt
          continue;
        }

        // Non-retryable error
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        yield {
          type: "error",
          error: `Agent error: ${errorMessage}`,
        };

        // Yield done with partial summary
        yield {
          type: "done",
          summary: buildSummary(),
        };
        return;
      }
    }

    // ─── Process response content blocks ────────────────────────
    const assistantContent: ContentBlockParam[] = [];
    const toolResults: ToolResultBlockParam[] = [];
    let hasToolUse = false;

    for (const block of response.content) {
      if (block.type === "thinking") {
        // Extended thinking block
        yield { type: "thinking", text: block.thinking };
        assistantContent.push({
          type: "thinking",
          thinking: block.thinking,
          signature: block.signature,
        } as unknown as ContentBlockParam);
      } else if (block.type === "text") {
        // Yield text to the stream
        yield { type: "text", text: block.text };
        assistantContent.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        hasToolUse = true;

        const isMCP = mcpManager.isMCPTool(block.name);
        const source: "builtin" | "mcp" = isMCP ? "mcp" : "builtin";
        let mcpServerName: string | undefined;

        if (isMCP) {
          const parsed = mcpManager.parseMCPToolName(block.name);
          mcpServerName = parsed?.serverName;
          if (mcpServerName) mcpServersUsed.add(mcpServerName);
        }

        // Yield tool call event
        yield {
          type: "tool_call",
          toolName: block.name,
          toolCallId: block.id,
          source,
          mcpServer: mcpServerName,
        };

        assistantContent.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        });

        // Execute the tool — route to built-in or MCP
        let resultMessage: string;
        let toolSuccess = true;

        if (isMCP) {
          const mcpResult = await mcpManager.callTool(
            block.name,
            block.input as Record<string, unknown>
          );
          resultMessage = mcpResult.content;
          toolSuccess = !mcpResult.isError;
        } else {
          const result = await executeToolCall(
            block.name,
            block.input as Record<string, unknown>,
            currentProject
          );

          resultMessage = result.message;
          toolSuccess = result.modified || !result.message.startsWith("Error");

          // If the tool modified the project, update our state and notify
          if (result.modified && result.project) {
            currentProject = result.project;
            projectModified = true;

            const trackCount = (currentProject.tracks ?? []).length;
            const clipCount = (currentProject.tracks ?? []).reduce(
              (sum, t) => sum + t.clips.length,
              0
            );

            yield {
              type: "project_update",
              project: currentProject,
              trackCount,
              clipCount,
            };
          }
        }

        // Track tool call stats
        toolCallStats.push({ name: block.name, success: toolSuccess, source });

        // Yield tool result
        yield {
          type: "tool_result",
          toolName: block.name,
          toolCallId: block.id,
          toolResult: resultMessage,
          source,
          mcpServer: mcpServerName,
        };

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: resultMessage,
        });
      }
    }

    // Add assistant message to conversation
    messages.push({
      role: "assistant",
      content: assistantContent,
    });

    // If there were tool calls, add tool results and continue the loop
    if (hasToolUse && toolResults.length > 0) {
      messages.push({
        role: "user",
        content: toolResults,
      });
      // Continue the loop — Claude will process tool results
      continue;
    }

    // No more tool calls — we're done
    break;
  }

  if (iteration >= maxIterations) {
    yield {
      type: "paused",
      text: `Reached maximum iterations (${maxIterations}). Click Continue to keep going.`,
      continuationMessages: messages,
      summary: buildSummary(),
    };
    return;
  }

  yield {
    type: "done",
    summary: buildSummary(),
  };

  // ─── Summary builder (closure over stats) ─────────────────────
  function buildSummary(): AgentSummary {
    return {
      totalIterations,
      toolCalls: toolCallStats,
      mcpServersUsed: Array.from(mcpServersUsed),
      inputTokens,
      thinkingTokens,
      outputTokens,
      durationMs: Date.now() - startTime,
      projectModified,
    };
  }
}
