/**
 * Session Store (Client-side Zustand)
 *
 * Manages the current AI session state and session list.
 * Sessions are conversation threads scoped to a project.
 */

import { create } from "zustand";

// ─── Types ──────────────────────────────────────────────────────────

export interface AiSessionSummary {
  id: string;
  title: string;
  status: string;
  providerId: string | null;
  modelId: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number;
  totalIterations: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStore {
  /** List of sessions for the current project */
  sessions: AiSessionSummary[];
  /** Currently active session ID */
  activeSessionId: string | null;
  /** Loading state */
  isLoading: boolean;

  // Actions
  setSessions: (sessions: AiSessionSummary[]) => void;
  setActiveSessionId: (id: string | null) => void;
  addSession: (session: AiSessionSummary) => void;
  updateSessionInList: (id: string, updates: Partial<AiSessionSummary>) => void;
  removeSession: (id: string) => void;
  setLoading: (loading: boolean) => void;

  // Async actions (fetch from API)
  fetchSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string) => Promise<AiSessionSummary | null>;
  deleteSession: (projectId: string, sessionId: string) => Promise<boolean>;
}

// ─── Store Implementation ───────────────────────────────────────────

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: false,

  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
    })),

  updateSessionInList: (id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id ? null : state.activeSessionId,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  fetchSessions: async (projectId: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/projects/${projectId}/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ sessions: data, isLoading: false });
    } catch (err) {
      console.error("[SessionStore] Failed to fetch sessions:", err);
      set({ isLoading: false });
    }
  },

  createSession: async (projectId: string, title?: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title ?? "New Session" }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const session = await res.json();

      set((state) => ({
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
      }));

      return session;
    } catch (err) {
      console.error("[SessionStore] Failed to create session:", err);
      return null;
    }
  },

  deleteSession: async (projectId: string, sessionId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/sessions/${sessionId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        activeSessionId:
          state.activeSessionId === sessionId ? null : state.activeSessionId,
      }));

      return true;
    } catch (err) {
      console.error("[SessionStore] Failed to delete session:", err);
      return false;
    }
  },
}));
