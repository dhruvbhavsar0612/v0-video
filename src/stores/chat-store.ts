/**
 * Chat Store
 *
 * Manages the chat conversation state between the user and the AI agent.
 * Uses a block-based model for assistant messages to support rich content
 * (thinking, tool calls, project updates, errors, rate limits).
 */

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

// ─── Content Block Types ────────────────────────────────────────────

export type ContentBlock =
  | { type: "thinking"; content: string }
  | { type: "text"; content: string }
  | {
      type: "tool_call";
      toolName: string;
      toolCallId: string;
      arguments?: Record<string, unknown>;
      result?: string;
      status: "pending" | "running" | "completed" | "failed";
      source: "builtin" | "mcp";
      mcpServer?: string;
    }
  | { type: "project_update"; clipCount?: number; trackCount?: number }
  | { type: "error"; content: string }
  | { type: "rate_limit"; waitMs?: number; message?: string };

// ─── Agent Summary ──────────────────────────────────────────────────

export interface AgentSummary {
  totalIterations: number;
  toolCalls: Array<{ name: string; success: boolean; source: string }>;
  mcpServersUsed: string[];
  inputTokens: number;
  thinkingTokens: number;
  outputTokens: number;
  durationMs: number;
  projectModified: boolean;
}

// ─── Message Types ──────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  /** Text content — used for user messages and backward compat */
  content: string;
  /** Block-based content — used for assistant messages */
  blocks?: ContentBlock[];
  /** Agent run summary — populated when done */
  summary?: AgentSummary;
  timestamp: string;
  /** Legacy tool call info — kept for backward compat */
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  arguments?: Record<string, unknown>;
  result?: string;
}

export type AgentStatus =
  | "idle"
  | "thinking"
  | "executing"
  | "generating"
  | "reviewing"
  | "rate_limited"
  | "paused"
  | "error";

// ─── Store Interface ────────────────────────────────────────────────

export interface ChatStore {
  messages: ChatMessage[];
  agentStatus: AgentStatus;
  agentStatusMessage: string;
  isProcessing: boolean;
  /** Serialized conversation state for continuing a paused agent run */
  continuationState: unknown[] | null;

  // Actions — original (backward compat)
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;

  // Agent status
  setAgentStatus: (status: AgentStatus, message?: string) => void;
  setProcessing: (processing: boolean) => void;

  // Streaming support
  appendToMessage: (messageId: string, content: string) => void;
  setMessageStreaming: (messageId: string, streaming: boolean) => void;

  // Block-based actions (new)
  addBlock: (messageId: string, block: ContentBlock) => void;
  updateBlock: (
    messageId: string,
    blockIndex: number,
    updates: Partial<ContentBlock>
  ) => void;
  setSummary: (messageId: string, summary: AgentSummary) => void;
  setContinuationState: (state: unknown[] | null) => void;
}

// ─── Store Implementation ───────────────────────────────────────────

export const useChatStore = create<ChatStore>((set) => ({
  messages: [
    {
      id: uuidv4(),
      role: "assistant",
      content:
        "Hi! I'm your AI video editor. Tell me what kind of video you'd like to create, and I'll help you build it. For example:\n\n- \"Create a 30-second reel about morning coffee routines\"\n- \"Make a promotional video for a fitness app\"\n- \"Build a travel montage with relaxing music\"",
      timestamp: new Date().toISOString(),
    },
  ],
  agentStatus: "idle",
  agentStatusMessage: "",
  isProcessing: false,
  continuationState: null,

  addMessage: (message) => {
    const id = uuidv4();
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
    return id;
  },

  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      ),
    })),

  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),

  clearMessages: () =>
    set({
      messages: [],
      agentStatus: "idle",
      agentStatusMessage: "",
      isProcessing: false,
      continuationState: null,
    }),

  setAgentStatus: (status, message = "") =>
    set({
      agentStatus: status,
      agentStatusMessage: message,
    }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  appendToMessage: (messageId, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + content } : m
      ),
    })),

  setMessageStreaming: (messageId, streaming) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, isStreaming: streaming } : m
      ),
    })),

  // ─── Block-based actions ────────────────────────────────────────

  addBlock: (messageId, block) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m;
        const blocks = m.blocks ? [...m.blocks, block] : [block];
        return { ...m, blocks };
      }),
    })),

  updateBlock: (messageId, blockIndex, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId || !m.blocks || !m.blocks[blockIndex]) return m;
        const blocks = [...m.blocks];
        blocks[blockIndex] = { ...blocks[blockIndex], ...updates } as ContentBlock;
        return { ...m, blocks };
      }),
    })),

  setSummary: (messageId, summary) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, summary } : m
      ),
    })),

  setContinuationState: (continuationState) =>
    set({ continuationState }),
}));
