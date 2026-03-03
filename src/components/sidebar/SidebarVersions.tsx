/**
 * SidebarVersions
 *
 * Version history panel adapted for the sidebar.
 * Shows version snapshots for the current project with restore buttons.
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  RotateCcw,
  Bot,
  User,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/stores/editor-store";
import type { VideoProject } from "@/lib/schema/video-schema";

interface VersionItem {
  id: string;
  versionNumber: number;
  createdBy: string;
  description: string | null;
  createdAt: string;
  projectData: VideoProject;
}

interface SidebarVersionsProps {
  projectId: string;
  onClose: () => void;
}

export const SidebarVersions: React.FC<SidebarVersionsProps> = ({
  projectId,
  // onClose prop is available but panel closing is handled by activity bar
}) => {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const loadProject = useEditorStore((s) => s.loadProject);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVersions(data);
    } catch (err) {
      console.error("[SidebarVersions] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRestore = async (versionId: string) => {
    if (!confirm("Restore this version? This will replace the current project state.")) {
      return;
    }

    setRestoring(versionId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/versions/${versionId}`,
        { method: "POST" }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const projectData = data.projectData as VideoProject;

      if (projectData) {
        loadProject(projectId, projectData);
      }

      await fetchVersions();
    } catch (err) {
      console.error("[SidebarVersions] Restore failed:", err);
      alert("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 min-h-0 bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0">
        <h2 className="text-xs font-semibold">Version History</h2>
      </div>

      {/* Versions List */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground px-4">
            No versions yet. Versions are created automatically when the AI makes changes.
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {versions.map((version, index) => (
              <React.Fragment key={version.id}>
                <div
                  className={`rounded-lg p-2.5 transition-colors cursor-pointer ${
                    expandedVersion === version.id
                      ? "bg-primary/5 border border-primary/30"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                  onClick={() =>
                    setExpandedVersion(
                      expandedVersion === version.id ? null : version.id
                    )
                  }
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-3.5 font-mono"
                      >
                        v{version.versionNumber}
                      </Badge>
                      {version.createdBy === "agent" ? (
                        <Bot className="h-3 w-3 text-purple-500" />
                      ) : (
                        <User className="h-3 w-3 text-blue-500" />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[9px] gap-0.5 px-1.5"
                      disabled={restoring !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(version.id);
                      }}
                    >
                      {restoring === version.id ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-2.5 w-2.5" />
                      )}
                      Restore
                    </Button>
                  </div>

                  {version.description && (
                    <p className="text-[10px] text-muted-foreground truncate mb-0.5">
                      {version.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatDate(version.createdAt)}</span>
                  </div>

                  {/* Expanded details */}
                  {expandedVersion === version.id && version.projectData && (
                    <div className="mt-1.5 pt-1.5 border-t text-[9px] text-muted-foreground space-y-0.5">
                      <div>
                        Title: {(version.projectData as VideoProject).metadata?.title}
                      </div>
                      <div>
                        Tracks:{" "}
                        {(version.projectData as VideoProject).tracks?.length ?? 0}
                      </div>
                      <div>
                        Clips:{" "}
                        {(version.projectData as VideoProject).tracks?.reduce(
                          (sum, t) => sum + (t.clips?.length ?? 0),
                          0
                        ) ?? 0}
                      </div>
                    </div>
                  )}
                </div>
                {index < versions.length - 1 && (
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
