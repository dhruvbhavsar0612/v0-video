/**
 * VersionHistory
 *
 * Side panel showing version snapshots for the current project.
 * Lists versions chronologically with restore buttons.
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  X,
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

interface VersionHistoryProps {
  projectId: string;
  onClose: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  projectId,
  onClose,
}) => {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<string | null>(null);

  const loadProject = useEditorStore((s) => s.loadProject);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVersions(data);
    } catch (err) {
      console.error("[VersionHistory] Failed to fetch:", err);
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
      // POST to restore — this creates a new version snapshot and updates the project
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

      // Refresh versions list
      await fetchVersions();
    } catch (err) {
      console.error("[VersionHistory] Restore failed:", err);
      alert("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  const handlePreview = (versionId: string) => {
    setPreviewVersion(previewVersion === versionId ? null : versionId);
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Version History</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Versions List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No versions yet
          </div>
        ) : (
          <div className="p-3 space-y-1">
            {versions.map((version, index) => (
              <div key={version.id}>
                <div
                  className={`rounded-lg p-3 transition-colors cursor-pointer ${
                    previewVersion === version.id
                      ? "bg-primary/5 border border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handlePreview(version.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                        v{version.versionNumber}
                      </Badge>
                      {version.createdBy === "agent" ? (
                        <Bot className="h-3.5 w-3.5 text-purple-500" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-blue-500" />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1"
                      disabled={restoring !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(version.id);
                      }}
                    >
                      {restoring === version.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Restore
                    </Button>
                  </div>

                  {version.description && (
                    <p className="text-xs text-muted-foreground truncate mb-1">
                      {version.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatDate(version.createdAt)}</span>
                  </div>

                  {/* Preview info when expanded */}
                  {previewVersion === version.id && version.projectData && (
                    <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground space-y-0.5">
                      <div>Title: {(version.projectData as VideoProject).metadata?.title}</div>
                      <div>Tracks: {(version.projectData as VideoProject).tracks?.length ?? 0}</div>
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
                {index < versions.length - 1 && <Separator className="my-1" />}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
