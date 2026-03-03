/**
 * EditorLayout (v2 — Fullscreen with Activity Bar + Sidebar)
 *
 * Layout:
 * ┌─────────┬──────────────────┬───────────────────────────────┐
 * │ Activity│   Sidebar Panel  │        Video Preview           │
 * │   Bar   │  (Chat/Sessions/ │     (takes all remaining       │
 * │ (icons) │   Settings)      │      space)                    │
 * │  48px   │   350px          │                                │
 * │         │  collapsible     │                                │
 * └─────────┴──────────────────┴───────────────────────────────┘
 *
 * The activity bar is always visible (48px wide, dark).
 * Clicking an icon toggles the sidebar panel open/closed.
 * The video preview gets 100% of remaining space.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ArrowLeft,
  Save,
  Check,
  AlertCircle,
  Loader2,
  History,
  Settings,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { VideoPreview } from "@/components/editor/VideoPreview";
import { SidebarChat } from "@/components/sidebar/SidebarChat";
import { SidebarSessions } from "@/components/sidebar/SidebarSessions";
import { SidebarSettings } from "@/components/sidebar/SidebarSettings";
import { SidebarVersions } from "@/components/sidebar/SidebarVersions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore, type SaveStatus } from "@/stores/editor-store";

// ─── Types ──────────────────────────────────────────────────────────

type SidebarPanel = "chat" | "sessions" | "versions" | "settings" | null;

const SIDEBAR_WIDTH = 380;
const ACTIVITY_BAR_WIDTH = 48;

// ─── Activity Bar Button ────────────────────────────────────────────

const ActivityBarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}> = ({ icon, label, isActive, onClick, badge }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 ${
          isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        {icon}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
        )}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={8}>
      {label}
    </TooltipContent>
  </Tooltip>
);

// ─── Save Indicator ─────────────────────────────────────────────────

const SaveIndicator: React.FC<{
  status: SaveStatus;
  isDirty: boolean;
  onSave: () => void;
}> = ({ status, isDirty, onSave }) => {
  if (status === "saving") {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving...
      </Badge>
    );
  }
  if (status === "saved") {
    return (
      <Badge variant="secondary" className="gap-1 text-xs text-green-600">
        <Check className="h-3 w-3" />
        Saved
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <AlertCircle className="h-3 w-3" />
        Save failed
      </Badge>
    );
  }
  if (isDirty) {
    return (
      <Button variant="ghost" size="sm" onClick={onSave} className="h-7 text-xs gap-1">
        <Save className="h-3 w-3" />
        Save
      </Button>
    );
  }
  return null;
};

// ─── Main Layout ────────────────────────────────────────────────────

export const EditorLayout: React.FC = () => {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<SidebarPanel>("chat");

  const projectTitle = useEditorStore((s) => s.project.metadata.title);
  const projectId = useEditorStore((s) => s.projectId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const save = useEditorStore((s) => s.save);

  const sidebarOpen = activePanel !== null;

  // Toggle panel: click same icon closes it, different icon switches
  const togglePanel = useCallback(
    (panel: SidebarPanel) => {
      setActivePanel((current) => (current === panel ? null : panel));
    },
    []
  );

  // Keyboard shortcut: Ctrl+S to save
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && projectId) {
          save();
        }
      }
      // Ctrl+B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setActivePanel((current) => (current ? null : "chat"));
      }
    },
    [isDirty, projectId, save]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        {/* Top Bar — thin, minimal */}
        <header className="flex items-center justify-between px-3 py-1.5 border-b bg-background/95 backdrop-blur z-20 h-11">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-bold tracking-tight">ReelForge</span>
            <span className="text-muted-foreground mx-0.5">/</span>
            <span className="text-xs font-medium truncate max-w-[200px] text-muted-foreground">
              {projectTitle}
            </span>
            <SaveIndicator status={saveStatus} isDirty={isDirty} onSave={save} />
          </div>
          <div className="flex items-center gap-1">
            {/* Toggle sidebar button for small screens */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setActivePanel((current) => (current ? null : "chat"))}
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Activity Bar — always visible */}
          <div
            className="flex-shrink-0 flex flex-col items-center py-3 gap-1 bg-muted/30 border-r"
            style={{ width: ACTIVITY_BAR_WIDTH }}
          >
            <ActivityBarButton
              icon={<MessageSquare className="h-4.5 w-4.5" />}
              label="AI Chat"
              isActive={activePanel === "chat"}
              onClick={() => togglePanel("chat")}
            />
            <ActivityBarButton
              icon={<Layers className="h-4.5 w-4.5" />}
              label="Sessions"
              isActive={activePanel === "sessions"}
              onClick={() => togglePanel("sessions")}
            />
            {projectId && (
              <ActivityBarButton
                icon={<History className="h-4.5 w-4.5" />}
                label="Version History"
                isActive={activePanel === "versions"}
                onClick={() => togglePanel("versions")}
              />
            )}

            {/* Spacer */}
            <div className="flex-1" />

            <ActivityBarButton
              icon={<Settings className="h-4.5 w-4.5" />}
              label="Settings"
              isActive={activePanel === "settings"}
              onClick={() => togglePanel("settings")}
            />
          </div>

          {/* Sidebar Panel — collapsible */}
          <div
            className="flex-shrink-0 border-r bg-background overflow-hidden transition-[width] duration-200 ease-in-out"
            style={{ width: sidebarOpen ? SIDEBAR_WIDTH : 0 }}
          >
            <div
              className="h-full overflow-hidden"
              style={{ width: SIDEBAR_WIDTH }}
            >
              {activePanel === "chat" && <SidebarChat />}
              {activePanel === "sessions" && <SidebarSessions />}
              {activePanel === "versions" && projectId && (
                <SidebarVersions
                  projectId={projectId}
                  onClose={() => setActivePanel(null)}
                />
              )}
              {activePanel === "settings" && <SidebarSettings />}
            </div>
          </div>

          {/* Video Preview — takes all remaining space */}
          <div className="flex-1 min-w-0 min-h-0">
            <VideoPreview />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
