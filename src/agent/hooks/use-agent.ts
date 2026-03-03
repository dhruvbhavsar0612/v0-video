/**
 * useAgent Hook
 *
 * Client-side hook that sends messages to the /api/agent endpoint,
 * processes the SSE stream, and updates both the chat and editor stores.
 *
 * Now supports:
 * - Session-aware requests (sends sessionId to API)
 * - Provider-aware requests (API route resolves API key)
 * - Saves messages to session on agent completion
 *
 * Handles all event types:
 * - thinking -> addBlock (thinking block)
 * - text -> addBlock (text block) + appendToMessage (legacy)
 * - tool_call -> addBlock (tool_call block with source/mcpServer)
 * - tool_result -> updateBlock (mark tool as completed with result)
 * - project_update -> addBlock (project_update) + setProject on editor
 * - rate_limit -> addBlock (rate_limit) + update agent status
 * - error -> addBlock (error block)
 * - paused -> save continuation state
 * - done -> setSummary + persist chat + persist session + finalize
 */

"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useEditorStore } from "@/stores/editor-store";
import { useSessionStore } from "@/stores/session-store";
import { useModelStore } from "@/stores/model-store";
import type { VideoProject } from "@/lib/schema/video-schema";
import type { AgentSummary, AgentStatus, ContentBlock } from "@/stores/chat-store";
import type { ChatMessage } from "@/stores/chat-store";

interface AgentEvent {
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
  text?: string;
  toolName?: string;
  toolCallId?: string;
  toolResult?: string;
  project?: VideoProject;
  error?: string;
  source?: "builtin" | "mcp";
  mcpServer?: string;
  waitMs?: number;
  remaining?: { requests: number; tokens: number };
  summary?: AgentSummary;
  trackCount?: number;
  clipCount?: number;
  continuationMessages?: unknown[];
}

// ─── Shared SSE event processor ─────────────────────────────────────

interface EventProcessorContext {
  assistantMessageId: string;
  toolCallBlockMap: Map<string, number>;
  currentBlockCount: number;
  // Store actions
  setAgentStatus: (status: AgentStatus, message?: string) => void;
  addBlock: (messageId: string, block: ContentBlock) => void;
  updateBlock: (messageId: string, index: number, updates: Partial<ContentBlock>) => void;
  appendToMessage: (messageId: string, text: string) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  setProject: (project: VideoProject) => void;
  setSummary: (messageId: string, summary: AgentSummary) => void;
  setContinuationState: (state: unknown[] | null) => void;
  setMessageStreaming: (messageId: string, streaming: boolean) => void;
  setProcessing: (processing: boolean) => void;
}

function processSSEEvent(
  event: AgentEvent,
  ctx: EventProcessorContext
): number {
  let blockCount = ctx.currentBlockCount;

  switch (event.type) {
    case "thinking":
      if (event.text) {
        ctx.setAgentStatus("thinking", "Reasoning...");
        ctx.addBlock(ctx.assistantMessageId, {
          type: "thinking",
          content: event.text,
        } as ContentBlock);
        blockCount++;
      }
      break;

    case "text":
      if (event.text) {
        ctx.setAgentStatus("generating", "Writing response...");
        ctx.appendToMessage(ctx.assistantMessageId, event.text);
        ctx.addBlock(ctx.assistantMessageId, {
          type: "text",
          content: event.text,
        } as ContentBlock);
        blockCount++;
      }
      break;

    case "tool_call": {
      ctx.setAgentStatus("executing", `Using ${event.toolName}...`);
      const blockIndex = blockCount;
      ctx.addBlock(ctx.assistantMessageId, {
        type: "tool_call",
        toolName: event.toolName || "unknown",
        toolCallId: event.toolCallId || "",
        status: "running",
        source: event.source || "builtin",
        mcpServer: event.mcpServer,
      } as ContentBlock);
      if (event.toolCallId) {
        ctx.toolCallBlockMap.set(event.toolCallId, blockIndex);
      }
      blockCount++;
      break;
    }

    case "tool_result": {
      const blockIndex = event.toolCallId
        ? ctx.toolCallBlockMap.get(event.toolCallId)
        : undefined;
      if (blockIndex !== undefined) {
        ctx.updateBlock(ctx.assistantMessageId, blockIndex, {
          status: "completed",
          result: event.toolResult,
        } as Partial<ContentBlock>);
      }
      break;
    }

    case "project_update":
      if (event.project) {
        ctx.setProject(event.project);
        ctx.setAgentStatus("generating", "Updating preview...");
        ctx.addBlock(ctx.assistantMessageId, {
          type: "project_update",
          trackCount: event.trackCount,
          clipCount: event.clipCount,
        } as ContentBlock);
        blockCount++;
      }
      break;

    case "rate_limit":
      ctx.setAgentStatus(
        "rate_limited",
        `Rate limited — retrying in ${Math.ceil((event.waitMs || 0) / 1000)}s...`
      );
      ctx.addBlock(ctx.assistantMessageId, {
        type: "rate_limit",
        waitMs: event.waitMs,
        message: `Rate limited — retrying in ${Math.ceil((event.waitMs || 0) / 1000)}s...`,
      } as ContentBlock);
      blockCount++;
      break;

    case "error":
      if (event.error) {
        ctx.addBlock(ctx.assistantMessageId, {
          type: "error",
          content: event.error,
        } as ContentBlock);
        blockCount++;

        const currentContent =
          useChatStore
            .getState()
            .messages.find((m) => m.id === ctx.assistantMessageId)
            ?.content || "";

        if (!currentContent) {
          ctx.updateMessage(ctx.assistantMessageId, {
            content: `Error: ${event.error}`,
          });
        } else {
          ctx.appendToMessage(
            ctx.assistantMessageId,
            `\n\nError: ${event.error}`
          );
        }
        ctx.setAgentStatus("error", event.error);
      }
      break;

    case "paused":
      if (event.continuationMessages) {
        ctx.setContinuationState(event.continuationMessages as unknown[]);
      }
      if (event.summary) {
        ctx.setSummary(ctx.assistantMessageId, event.summary);
      }
      ctx.addBlock(ctx.assistantMessageId, {
        type: "text",
        content:
          event.text ||
          "Reached maximum iterations. Click Continue to keep going.",
      } as ContentBlock);
      blockCount++;

      ctx.setMessageStreaming(ctx.assistantMessageId, false);
      ctx.setProcessing(false);
      ctx.setAgentStatus(
        "paused",
        "Agent paused — click Continue to resume"
      );
      break;

    case "done":
      if (event.summary) {
        ctx.setSummary(ctx.assistantMessageId, event.summary);
      }

      // Persist chat + session + project
      persistOnDone(event.summary);

      ctx.setMessageStreaming(ctx.assistantMessageId, false);
      ctx.setProcessing(false);
      ctx.setAgentStatus("idle");
      break;
  }

  return blockCount;
}

/**
 * Persist chat messages, session messages, and project on agent done.
 */
function persistOnDone(summary?: AgentSummary) {
  const editorState = useEditorStore.getState();
  const pid = editorState.projectId;
  if (!pid) return;

  const chatMessages = useChatStore.getState().messages;

  // 1. Persist chat messages (legacy endpoint — kept for backward compat)
  fetch(`/api/projects/${pid}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: chatMessages }),
  }).catch((err) => {
    console.warn("[useAgent] Failed to persist chat:", err);
  });

  // 2. Persist messages to active session
  const activeSessionId = useSessionStore.getState().activeSessionId;
  if (activeSessionId) {
    fetch(`/api/projects/${pid}/sessions/${activeSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages }),
    }).catch((err) => {
      console.warn("[useAgent] Failed to persist session messages:", err);
    });

    // Update session token counts in client store
    if (summary) {
      useSessionStore.getState().updateSessionInList(activeSessionId, {
        totalInputTokens:
          (useSessionStore.getState().sessions.find((s) => s.id === activeSessionId)
            ?.totalInputTokens ?? 0) + (summary.inputTokens ?? 0),
        totalOutputTokens:
          (useSessionStore.getState().sessions.find((s) => s.id === activeSessionId)
            ?.totalOutputTokens ?? 0) + (summary.outputTokens ?? 0),
        totalThinkingTokens:
          (useSessionStore.getState().sessions.find((s) => s.id === activeSessionId)
            ?.totalThinkingTokens ?? 0) + (summary.thinkingTokens ?? 0),
        totalIterations:
          (useSessionStore.getState().sessions.find((s) => s.id === activeSessionId)
            ?.totalIterations ?? 0) + (summary.totalIterations ?? 0),
      });
    }
  }

  // 3. Save project + version snapshot if modified
  if (summary?.projectModified) {
    editorState
      .save()
      .then(() => {
        fetch(`/api/projects/${pid}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: "AI agent edit",
            createdBy: "agent",
          }),
        }).catch((err) => {
          console.warn("[useAgent] Failed to create version snapshot:", err);
        });
      })
      .catch((err) => {
        console.warn("[useAgent] Auto-save failed:", err);
      });
  }
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useAgent() {
  const abortControllerRef = useRef<AbortController | null>(null);

  // Chat store actions
  const addMessage = useChatStore((s) => s.addMessage);
  const appendToMessage = useChatStore((s) => s.appendToMessage);
  const setMessageStreaming = useChatStore((s) => s.setMessageStreaming);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setAgentStatus = useChatStore((s) => s.setAgentStatus);
  const setProcessing = useChatStore((s) => s.setProcessing);
  const addBlock = useChatStore((s) => s.addBlock);
  const updateBlock = useChatStore((s) => s.updateBlock);
  const setSummary = useChatStore((s) => s.setSummary);
  const setContinuationState = useChatStore((s) => s.setContinuationState);
  const messages = useChatStore((s) => s.messages);

  // Editor store actions
  const setProject = useEditorStore((s) => s.setProject);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Add user message to chat
      addMessage({ role: "user", content: userMessage });

      // Set processing state
      setProcessing(true);
      setAgentStatus("thinking", "Processing your request...");

      // Create a placeholder assistant message for streaming
      const assistantMessageId = addMessage({
        role: "assistant",
        content: "",
        blocks: [],
        isStreaming: true,
      });

      // Track tool call block indices for updating with results
      const toolCallBlockMap = new Map<string, number>();
      let currentBlockCount = 0;

      // Create processor context
      const ctx: EventProcessorContext = {
        assistantMessageId,
        toolCallBlockMap,
        currentBlockCount,
        setAgentStatus,
        addBlock,
        updateBlock,
        appendToMessage,
        updateMessage,
        setProject,
        setSummary,
        setContinuationState,
        setMessageStreaming,
        setProcessing,
      };

      try {
        // Build conversation history from existing messages (exclude the ones we just added)
        const conversationHistory = messages
          .filter(
            (m) =>
              (m.role === "user" || m.role === "assistant") && !m.isStreaming
          )
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // Get current project state and session ID
        const currentProject = useEditorStore.getState().project;
        const activeSessionId = useSessionStore.getState().activeSessionId;

        // Get selected provider/model from model store
        const { selectedProviderId, selectedModelId } = useModelStore.getState();

        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            project: currentProject,
            conversationHistory,
            sessionId: activeSessionId ?? undefined,
            providerId: selectedProviderId ?? undefined,
            modelId: selectedModelId ?? undefined,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}`
          );
        }

        // Process the SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (delimited by \n\n)
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // Keep incomplete event in buffer

          for (const eventStr of events) {
            if (!eventStr.startsWith("data: ")) continue;

            try {
              const event: AgentEvent = JSON.parse(eventStr.slice(6));
              ctx.currentBlockCount = currentBlockCount;
              currentBlockCount = processSSEEvent(event, ctx);
            } catch {
              // Ignore malformed events
              console.warn("Failed to parse SSE event:", eventStr);
            }
          }
        }

        // Ensure we finalize even if "done" event was missed
        setMessageStreaming(assistantMessageId, false);
        setProcessing(false);
        setAgentStatus("idle");
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled — clean up silently
          setMessageStreaming(assistantMessageId, false);
          setProcessing(false);
          setAgentStatus("idle");
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        updateMessage(assistantMessageId, {
          content: `Failed to connect to AI agent: ${errorMessage}`,
          isStreaming: false,
        });
        addBlock(assistantMessageId, {
          type: "error",
          content: `Failed to connect to AI agent: ${errorMessage}`,
        });
        setProcessing(false);
        setAgentStatus("error", errorMessage);
      }
    },
    [
      addMessage,
      appendToMessage,
      setMessageStreaming,
      updateMessage,
      setAgentStatus,
      setProcessing,
      setProject,
      addBlock,
      updateBlock,
      setSummary,
      setContinuationState,
      messages,
    ]
  );

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProcessing(false);
    setAgentStatus("idle");
    setContinuationState(null);
  }, [setProcessing, setAgentStatus, setContinuationState]);

  const continueAgent = useCallback(async () => {
    const continuationState = useChatStore.getState().continuationState;
    if (!continuationState) return;

    // Clear the continuation state
    setContinuationState(null);

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Set processing state
    setProcessing(true);
    setAgentStatus("thinking", "Continuing from where we left off...");

    // Create a placeholder assistant message for the continuation
    const assistantMessageId = addMessage({
      role: "assistant",
      content: "",
      blocks: [],
      isStreaming: true,
    });

    const toolCallBlockMap = new Map<string, number>();
    let currentBlockCount = 0;

    const ctx: EventProcessorContext = {
      assistantMessageId,
      toolCallBlockMap,
      currentBlockCount,
      setAgentStatus,
      addBlock,
      updateBlock,
      appendToMessage,
      updateMessage,
      setProject,
      setSummary,
      setContinuationState,
      setMessageStreaming,
      setProcessing,
    };

    try {
      const currentProject = useEditorStore.getState().project;
      const activeSessionId = useSessionStore.getState().activeSessionId;

      // Get selected provider/model from model store
      const { selectedProviderId, selectedModelId } = useModelStore.getState();

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "__continue__",
          project: currentProject,
          continuationMessages: continuationState,
          sessionId: activeSessionId ?? undefined,
          providerId: selectedProviderId ?? undefined,
          modelId: selectedModelId ?? undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || `HTTP ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventStr of events) {
          if (!eventStr.startsWith("data: ")) continue;

          try {
            const event: AgentEvent = JSON.parse(eventStr.slice(6));
            ctx.currentBlockCount = currentBlockCount;
            currentBlockCount = processSSEEvent(event, ctx);
          } catch {
            console.warn("Failed to parse SSE event:", eventStr);
          }
        }
      }

      setMessageStreaming(assistantMessageId, false);
      setProcessing(false);
      setAgentStatus("idle");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessageStreaming(assistantMessageId, false);
        setProcessing(false);
        setAgentStatus("idle");
        return;
      }

      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      updateMessage(assistantMessageId, {
        content: `Failed to continue agent: ${errorMessage}`,
        isStreaming: false,
      });
      addBlock(assistantMessageId, {
        type: "error",
        content: `Failed to continue agent: ${errorMessage}`,
      });
      setProcessing(false);
      setAgentStatus("error", errorMessage);
    }
  }, [
    addMessage,
    appendToMessage,
    setMessageStreaming,
    updateMessage,
    setAgentStatus,
    setProcessing,
    setProject,
    addBlock,
    updateBlock,
    setSummary,
    setContinuationState,
  ]);

  return { sendMessage, cancelRequest, continueAgent };
}
