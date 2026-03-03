/**
 * Agent API Route
 *
 * POST /api/agent
 *
 * Accepts a user message and current project state,
 * runs the AI agent, and streams results back via
 * Server-Sent Events (SSE).
 *
 * Now supports:
 * - Authentication via better-auth session
 * - Session-based conversations (sessionId)
 * - Provider-aware API key resolution (user config > env var)
 * - Session event logging and token tracking
 *
 * Request body:
 * {
 *   message: string;
 *   project: VideoProject;
 *   conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
 *   continuationMessages?: unknown[];
 *   sessionId?: string;
 *   providerId?: string;
 *   modelId?: string;
 * }
 *
 * Response: text/event-stream with JSON events
 */

import { NextRequest } from "next/server";
import { runAgent, type AgentEvent } from "@/agent/agent-core";
import { runAgentOpenAI } from "@/agent/agent-openai";
import type { VideoProject } from "@/lib/schema/video-schema";
import { getServerSession } from "@/lib/auth-session";
import { resolveApiKey, getProviderConfig } from "@/lib/storage/provider-store";
import { getCopilotSessionToken } from "@/lib/copilot/token-manager";
import {
  incrementSessionTokens,
  logSessionEvent,
  updateSession,
} from "@/lib/storage/session-store";

export const runtime = "nodejs";
export const maxDuration = 120; // Allow up to 120 seconds for agent runs (extended thinking + MCP)

export async function POST(request: NextRequest) {
  try {
    // ─── Authenticate ─────────────────────────────────────────────
    const session = await getServerSession();
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const userId = session.user.id;

    // ─── Parse request body ───────────────────────────────────────
    const body = await request.json();

    const {
      message,
      project,
      conversationHistory = [],
      continuationMessages,
      sessionId,
      providerId = "anthropic",
      modelId,
    } = body as {
      message: string;
      project: VideoProject;
      conversationHistory?: Array<{
        role: "user" | "assistant";
        content: string;
      }>;
      continuationMessages?: unknown[];
      sessionId?: string;
      providerId?: string;
      modelId?: string;
    };

    if (!message || !project) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message, project" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ─── Resolve API key / token based on provider ─────────────────
    let apiKey: string | null = null;
    let copilotSessionToken: string | null = null;
    let agentBaseUrl: string | undefined;
    let agentExtraHeaders: Record<string, string> | undefined;

    if (providerId === "copilot") {
      // Copilot: get the GitHub access token, then exchange for session token
      const config = await getProviderConfig(userId, "copilot");
      if (!config?.accessToken) {
        return new Response(
          JSON.stringify({
            error:
              "GitHub Copilot is not connected. Connect it in Settings.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        copilotSessionToken = await getCopilotSessionToken(config.accessToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Token exchange failed";
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      apiKey = copilotSessionToken;
      agentBaseUrl = "https://api.githubcopilot.com";
      agentExtraHeaders = {
        "Copilot-Integration-Id": "vscode-chat",
        "Editor-Version": "vscode/1.100.0",
        "Editor-Plugin-Version": "copilot-chat/0.25.0",
      };
    } else {
      apiKey = await resolveApiKey(userId, providerId);
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: `No API key found for ${providerId}. Configure it in Settings or set the environment variable.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ─── Log session start event ──────────────────────────────────
    if (sessionId) {
      await logSessionEvent(sessionId, "agent_start", {
        message: message.substring(0, 500), // truncate for storage
        providerId,
        modelId: modelId ?? undefined,
      }).catch((err) =>
        console.warn("[Agent Route] Failed to log session start:", err)
      );
    }

    // ─── Create SSE stream ────────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function sendEvent(event: AgentEvent) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        try {
          // ─── Dispatch to the right agent runner ─────────────
          const useOpenAI =
            providerId === "copilot" || providerId === "openai";

          const agentRunner = useOpenAI
            ? runAgentOpenAI({
                userMessage: message,
                project,
                conversationHistory,
                apiKey,
                model: modelId,
                baseUrl: agentBaseUrl,
                extraHeaders: agentExtraHeaders,
              })
            : runAgent({
                userMessage: message,
                project,
                conversationHistory,
                continuationMessages:
                  continuationMessages as
                    | import("@anthropic-ai/sdk/resources/messages").MessageParam[]
                    | undefined,
                apiKey,
                model: modelId,
              });

          let lastSummary: AgentEvent["summary"] | undefined;
          let lastContinuationMessages: unknown[] | undefined;

          for await (const event of agentRunner) {
            sendEvent(event);

            // Capture summary and continuation state for post-run logging
            if (event.type === "done" || event.type === "paused") {
              lastSummary = event.summary;
            }
            if (event.type === "paused" && event.continuationMessages) {
              lastContinuationMessages = event.continuationMessages;
            }
          }

          // ─── Post-run session logging ─────────────────────────
          if (sessionId && lastSummary) {
            // Update session token counts atomically
            await incrementSessionTokens(
              sessionId,
              lastSummary.inputTokens ?? 0,
              lastSummary.outputTokens ?? 0,
              lastSummary.thinkingTokens ?? 0,
              lastSummary.totalIterations ?? 0
            ).catch((err) =>
              console.warn("[Agent Route] Failed to update session tokens:", err)
            );

            // Log completion event
            await logSessionEvent(
              sessionId,
              lastContinuationMessages ? "agent_paused" : "agent_done",
              {
                totalIterations: lastSummary.totalIterations,
                toolCalls: lastSummary.toolCalls,
                projectModified: lastSummary.projectModified,
                mcpServersUsed: lastSummary.mcpServersUsed,
              },
              {
                input: lastSummary.inputTokens,
                output: lastSummary.outputTokens,
                thinking: lastSummary.thinkingTokens,
              },
              lastSummary.durationMs
            ).catch((err) =>
              console.warn("[Agent Route] Failed to log session event:", err)
            );

            // Save continuation state to session if paused
            if (lastContinuationMessages) {
              await updateSession(sessionId, userId, {
                continuationState: lastContinuationMessages,
              }).catch((err) =>
                console.warn(
                  "[Agent Route] Failed to save continuation state:",
                  err
                )
              );
            }
          }
        } catch (err: unknown) {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error";
          sendEvent({
            type: "error",
            error: `Server error: ${errorMessage}`,
          });
          sendEvent({ type: "done" });

          // Log error event to session
          if (sessionId) {
            await logSessionEvent(sessionId, "agent_error", {
              error: errorMessage,
            }).catch(() => {});
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
