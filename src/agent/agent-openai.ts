/**
 * Agent OpenAI
 *
 * An OpenAI-compatible agent runner that uses the same tool loop as
 * agent-core.ts but speaks the OpenAI Chat Completions API format.
 *
 * This powers:
 * - GitHub Copilot (api.githubcopilot.com — OpenAI-compatible)
 * - Direct OpenAI API usage
 *
 * Key differences from agent-core.ts:
 * - No extended thinking (not supported in OpenAI format)
 * - OpenAI-format tool definitions (function calling)
 * - OpenAI message format (role/content/tool_calls/tool_call_id)
 * - Uses fetch directly instead of OpenAI SDK to avoid version issues
 */

import type { VideoProject } from "@/lib/schema/video-schema";
import { buildSystemPrompt } from "@/agent/prompts/system-prompt";
import { agentTools } from "@/agent/tools/tool-definitions";
import { executeToolCall } from "@/agent/tools/tool-executor";
import { MCPManager } from "@/agent/mcp/mcp-manager";
import type { AgentEvent, AgentRunOptions } from "@/agent/agent-core";
import type { AgentSummary } from "@/stores/chat-store";

// ─── Types ──────────────────────────────────────────────────────────

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────────

const MAX_ITERATIONS = 10;
const DEFAULT_MODEL = "gpt-4o";
const MAX_TOKENS = 16000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// ─── Tool Format Conversion ─────────────────────────────────────────

/**
 * Convert Anthropic-format tool definitions to OpenAI function calling format.
 */
function convertToolsToOpenAI(
  anthropicTools: typeof agentTools
): OpenAITool[] {
  return anthropicTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.input_schema as Record<string, unknown>,
    },
  }));
}

/**
 * Convert MCP tools (already in Anthropic format) to OpenAI format.
 */
function convertMCPToolsToOpenAI(
  mcpTools: Array<{ name: string; description?: string; input_schema: unknown }>
): OpenAITool[] {
  return mcpTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: (tool.input_schema as Record<string, unknown>) ?? { type: "object", properties: {} },
    },
  }));
}

// ─── Agent Runner ───────────────────────────────────────────────────

export interface OpenAIAgentRunOptions extends AgentRunOptions {
  /** Base URL for the API (default: https://api.openai.com/v1) */
  baseUrl?: string;
  /** Extra headers to send (e.g., Copilot editor/plugin headers) */
  extraHeaders?: Record<string, string>;
}

/**
 * Runs the AI agent using the OpenAI-compatible Chat Completions API.
 * Used for GitHub Copilot and direct OpenAI usage.
 */
export async function* runAgentOpenAI(
  options: OpenAIAgentRunOptions
): AsyncGenerator<AgentEvent> {
  const {
    userMessage,
    project: initialProject,
    conversationHistory = [],
    maxIterations = MAX_ITERATIONS,
    apiKey: overrideApiKey,
    model: overrideModel,
    baseUrl = "https://api.openai.com/v1",
    extraHeaders = {},
  } = options;

  const apiKey = overrideApiKey;
  if (!apiKey) {
    yield {
      type: "error",
      error: "No API key or token configured for this provider.",
    };
    yield { type: "done" };
    return;
  }

  const modelId = overrideModel ?? DEFAULT_MODEL;

  // ─── Initialize MCP ─────────────────────────────────────────────
  const mcpManager = MCPManager.getInstance();
  try {
    await mcpManager.initialize();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown MCP error";
    console.warn(`[AgentOpenAI] MCP initialization failed: ${msg}`);
  }

  // Convert tools to OpenAI format
  const builtinToolsOAI = convertToolsToOpenAI(agentTools);
  const mcpToolsRaw = mcpManager.getAllTools();
  const mcpToolsOAI = convertMCPToolsToOpenAI(
    mcpToolsRaw as Array<{ name: string; description?: string; input_schema: unknown }>
  );
  const allTools = [...builtinToolsOAI, ...mcpToolsOAI];

  // ─── Stats tracking ─────────────────────────────────────────────
  const startTime = Date.now();
  let totalIterations = 0;
  const toolCallStats: Array<{
    name: string;
    success: boolean;
    source: string;
  }> = [];
  const mcpServersUsed = new Set<string>();
  let inputTokens = 0;
  let outputTokens = 0;
  let projectModified = false;

  let currentProject = initialProject;

  // ─── Build messages ─────────────────────────────────────────────
  const systemPromptText = buildSystemPrompt(currentProject);

  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPromptText },
    // Conversation history
    ...conversationHistory.map(
      (msg) =>
        ({
          role: msg.role,
          content: msg.content,
        }) as OpenAIMessage
    ),
    // Current user message
    { role: "user", content: userMessage },
  ];

  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    totalIterations = iteration;

    // ─── Call the API with retries ──────────────────────────────
    let chatResponse: OpenAIChatResponse;
    let retryAttempt = 0;

    while (true) {
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...extraHeaders,
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: MAX_TOKENS,
            messages,
            tools: allTools.length > 0 ? allTools : undefined,
          }),
        });

        if (res.status === 429 && retryAttempt < MAX_RETRIES) {
          const retryAfter = res.headers.get("retry-after");
          const backoffMs = retryAfter
            ? parseFloat(retryAfter) * 1000
            : BASE_BACKOFF_MS * Math.pow(2, retryAttempt);

          yield {
            type: "rate_limit",
            waitMs: backoffMs,
            remaining: { requests: 0, tokens: 0 },
          };

          await new Promise((r) => setTimeout(r, backoffMs));
          retryAttempt++;
          continue;
        }

        if (res.status === 500 && retryAttempt < MAX_RETRIES) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, retryAttempt);
          console.warn(
            `[AgentOpenAI] 500 error, retry ${retryAttempt + 1}/${MAX_RETRIES}`
          );

          await new Promise((r) => setTimeout(r, backoffMs));
          retryAttempt++;
          continue;
        }

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(
            `API error ${res.status}: ${errorBody.substring(0, 500)}`
          );
        }

        chatResponse = (await res.json()) as OpenAIChatResponse;

        // Track usage
        if (chatResponse.usage) {
          inputTokens += chatResponse.usage.prompt_tokens;
          outputTokens += chatResponse.usage.completion_tokens;
        }

        break;
      } catch (err: unknown) {
        if (retryAttempt < MAX_RETRIES) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, retryAttempt);
          await new Promise((r) => setTimeout(r, backoffMs));
          retryAttempt++;
          continue;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        yield { type: "error", error: `Agent error: ${errorMessage}` };
        yield { type: "done", summary: buildSummary() };
        return;
      }
    }

    // ─── Process response ───────────────────────────────────────
    const choice = chatResponse.choices[0];
    if (!choice) {
      yield { type: "error", error: "No response from model" };
      yield { type: "done", summary: buildSummary() };
      return;
    }

    const assistantMessage = choice.message;

    // Yield text content
    if (assistantMessage.content) {
      yield { type: "text", text: assistantMessage.content };
    }

    // Check for tool calls
    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      // No tool calls — done
      messages.push({
        role: "assistant",
        content: assistantMessage.content,
      });
      break;
    }

    // Add assistant message with tool calls to conversation
    messages.push({
      role: "assistant",
      content: assistantMessage.content,
      tool_calls: toolCalls,
    });

    // Execute each tool call
    for (const toolCall of toolCalls) {
      const fnName = toolCall.function.name;
      let fnArgs: Record<string, unknown> = {};
      try {
        fnArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        // Malformed JSON from model — skip
        yield {
          type: "tool_result",
          toolName: fnName,
          toolCallId: toolCall.id,
          toolResult: "Error: Failed to parse tool arguments",
        };
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: "Error: Failed to parse tool arguments",
        });
        toolCallStats.push({ name: fnName, success: false, source: "builtin" });
        continue;
      }

      const isMCP = mcpManager.isMCPTool(fnName);
      const source: "builtin" | "mcp" = isMCP ? "mcp" : "builtin";
      let mcpServerName: string | undefined;

      if (isMCP) {
        const parsed = mcpManager.parseMCPToolName(fnName);
        mcpServerName = parsed?.serverName;
        if (mcpServerName) mcpServersUsed.add(mcpServerName);
      }

      yield {
        type: "tool_call",
        toolName: fnName,
        toolCallId: toolCall.id,
        source,
        mcpServer: mcpServerName,
      };

      // Execute
      let resultMessage: string;
      let toolSuccess = true;

      if (isMCP) {
        const mcpResult = await mcpManager.callTool(fnName, fnArgs);
        resultMessage = mcpResult.content;
        toolSuccess = !mcpResult.isError;
      } else {
        const result = await executeToolCall(fnName, fnArgs, currentProject);
        resultMessage = result.message;
        toolSuccess = result.modified || !result.message.startsWith("Error");

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

      toolCallStats.push({ name: fnName, success: toolSuccess, source });

      yield {
        type: "tool_result",
        toolName: fnName,
        toolCallId: toolCall.id,
        toolResult: resultMessage,
        source,
        mcpServer: mcpServerName,
      };

      // Add tool result to messages
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultMessage,
      });
    }

    // Continue loop — model will process tool results
  }

  if (iteration >= maxIterations) {
    yield {
      type: "paused",
      text: `Reached maximum iterations (${maxIterations}). Click Continue to keep going.`,
      summary: buildSummary(),
    };
    return;
  }

  yield { type: "done", summary: buildSummary() };

  function buildSummary(): AgentSummary {
    return {
      totalIterations,
      toolCalls: toolCallStats,
      mcpServersUsed: Array.from(mcpServersUsed),
      inputTokens,
      thinkingTokens: 0, // No thinking in OpenAI format
      outputTokens,
      durationMs: Date.now() - startTime,
      projectModified,
    };
  }
}
