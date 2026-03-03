/**
 * SidebarSessions
 *
 * Lists all AI sessions for the current project.
 * Allows creating new sessions, switching between them,
 * and deleting old ones.
 */

"use client";

import React, { useEffect, useCallback } from "react";
import {
  Plus,
  Loader2,
  MessageSquare,
  Trash2,
  Clock,
  Zap,
  Hash,
} from "lucide-react";

import { useSessionStore, type AiSessionSummary } from "@/stores/session-store";
import { useChatStore, type ContentBlock, type AgentSummary } from "@/stores/chat-store";
import { useEditorStore } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ─── Session Card ───────────────────────────────────────────────────

const SessionCard: React.FC<{
  session: AiSessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ session, isActive, onSelect, onDelete }) => {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const totalTokens = session.totalInputTokens + session.totalOutputTokens;

  return (
    <div
      onClick={onSelect}
      className={`group rounded-lg p-2.5 cursor-pointer transition-all duration-150 ${
        isActive
          ? "bg-primary/10 border border-primary/30 shadow-sm"
          : "hover:bg-muted/50 border border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium truncate">{session.title}</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatDate(session.updatedAt)}
            </span>
            {session.totalIterations > 0 && (
              <span className="flex items-center gap-0.5">
                <Hash className="h-2.5 w-2.5" />
                {session.totalIterations} iter
              </span>
            )}
            {totalTokens > 0 && (
              <span className="flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                {totalTokens > 1000
                  ? `${(totalTokens / 1000).toFixed(1)}k`
                  : totalTokens}
              </span>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>

      {session.providerId && (
        <div className="mt-1.5">
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
            {session.providerId}
            {session.modelId && ` / ${session.modelId.split("-").slice(0, 2).join("-")}`}
          </Badge>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────

export const SidebarSessions: React.FC = () => {
  const projectId = useEditorStore((s) => s.projectId);
  const {
    sessions,
    activeSessionId,
    isLoading,
    fetchSessions,
    createSession,
    deleteSession,
    setActiveSessionId,
  } = useSessionStore();

  // Fetch sessions on mount
  useEffect(() => {
    if (projectId) {
      fetchSessions(projectId);
    }
  }, [projectId, fetchSessions]);

  const handleCreateSession = useCallback(async () => {
    if (!projectId) return;
    const session = await createSession(projectId);
    if (session) {
      // Clear chat for the new session
      useChatStore.getState().clearMessages();
      useChatStore.getState().addMessage({
        role: "assistant",
        content:
          "New session started! Tell me what you'd like to do with this video.",
      });
    }
  }, [projectId, createSession]);

  const handleSelectSession = useCallback(
    async (session: AiSessionSummary) => {
      if (!projectId || session.id === activeSessionId) return;

      setActiveSessionId(session.id);

      // Load session messages from the API
      try {
        const res = await fetch(
          `/api/projects/${projectId}/sessions/${session.id}`
        );
        if (res.ok) {
          const data = await res.json();
          const messages = (data.messages as unknown[]) ?? [];

          // Replace chat store messages with session messages
          useChatStore.getState().clearMessages();
          if (messages.length > 0) {
            for (const msg of messages as Array<{
              role: "user" | "assistant" | "system";
              content: string;
              blocks?: ContentBlock[];
              summary?: AgentSummary;
            }>) {
              useChatStore.getState().addMessage(msg);
            }
          } else {
            useChatStore.getState().addMessage({
              role: "assistant",
              content: `Resumed session: ${session.title}`,
            });
          }

          // Restore continuation state if present
          if (data.continuationState) {
            useChatStore.getState().setContinuationState(data.continuationState);
            useChatStore.getState().setAgentStatus("paused", "Agent was paused");
          }
        }
      } catch (err) {
        console.error("[SidebarSessions] Failed to load session:", err);
      }
    },
    [projectId, activeSessionId, setActiveSessionId]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!projectId) return;
      if (!confirm("Delete this session? This cannot be undone.")) return;
      await deleteSession(projectId, sessionId);
    },
    [projectId, deleteSession]
  );

  return (
    <div className="flex flex-col h-full w-full min-w-0 min-h-0 bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0">
        <h2 className="text-xs font-semibold">Sessions</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={handleCreateSession}
          disabled={!projectId}
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 gap-3">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground">
                No sessions yet
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                Create a new session to start a conversation with the AI editor.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleCreateSession}
              disabled={!projectId}
            >
              <Plus className="h-3 w-3" />
              Create Session
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session, index) => (
              <React.Fragment key={session.id}>
                <SessionCard
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => handleSelectSession(session)}
                  onDelete={() => handleDeleteSession(session.id)}
                />
                {index < sessions.length - 1 && (
                  <Separator className="my-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
