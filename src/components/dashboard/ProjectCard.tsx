/**
 * ProjectCard
 *
 * Displays a project in the dashboard grid with title, dates,
 * version count badge, and a solid color thumbnail from the
 * project's backgroundColor.
 */

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2, Clock, Layers } from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VideoProject } from "@/lib/schema/video-schema";

interface ProjectCardProps {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  projectData: VideoProject;
  createdAt: Date;
  updatedAt: Date;
  onDelete?: (id: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  id,
  title,
  description,
  status,
  projectData,
  createdAt,
  updatedAt,
  onDelete,
}) => {
  const router = useRouter();

  const bgColor = projectData?.metadata?.backgroundColor ?? "#000000";
  const aspectRatio = projectData?.metadata?.aspectRatio ?? "9:16";
  const duration = projectData?.metadata?.duration ?? 0;
  const trackCount = projectData?.tracks?.length ?? 0;
  const clipCount =
    projectData?.tracks?.reduce((sum, t) => sum + (t.clips?.length ?? 0), 0) ??
    0;

  const formatDate = (date: Date) => {
    const d = new Date(date);
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

  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
      onClick={() => router.push(`/editor/${id}`)}
    >
      {/* Thumbnail — solid color from project backgroundColor */}
      <CardHeader className="p-0">
        <div
          className="w-full h-36 rounded-t-lg flex items-center justify-center relative overflow-hidden"
          style={{ backgroundColor: bgColor }}
        >
          {/* Aspect ratio badge */}
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 text-[10px] bg-black/50 text-white border-0"
          >
            {aspectRatio}
          </Badge>

          {/* Duration badge */}
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 text-[10px] bg-black/50 text-white border-0"
          >
            {duration}s
          </Badge>

          {/* Center content preview info */}
          <div className="text-white/70 text-xs font-mono">
            {trackCount > 0 ? (
              <div className="text-center">
                <Layers className="h-6 w-6 mx-auto mb-1 opacity-50" />
                <span>
                  {trackCount} track{trackCount !== 1 ? "s" : ""} &middot;{" "}
                  {clipCount} clip{clipCount !== 1 ? "s" : ""}
                </span>
              </div>
            ) : (
              <span className="opacity-50">Empty project</span>
            )}
          </div>

          {/* Delete button — appears on hover */}
          {onDelete && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute bottom-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pb-1">
        <h3 className="font-semibold text-sm truncate">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {description}
          </p>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-1 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatDate(updatedAt)}</span>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
          {status}
        </Badge>
      </CardFooter>
    </Card>
  );
};
