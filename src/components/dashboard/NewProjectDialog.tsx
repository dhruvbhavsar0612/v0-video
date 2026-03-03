/**
 * NewProjectDialog
 *
 * Dialog for creating a new project with title, aspect ratio selection,
 * and template choice. POSTs to /api/projects on submit.
 */

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AspectRatio } from "@/lib/schema/video-schema";

const ASPECT_RATIO_OPTIONS: {
  value: AspectRatio;
  label: string;
  description: string;
}[] = [
  { value: "9:16", label: "9:16", description: "Reels, TikTok, Shorts" },
  { value: "16:9", label: "16:9", description: "YouTube, standard" },
  { value: "1:1", label: "1:1", description: "Instagram post" },
  { value: "4:5", label: "4:5", description: "Instagram feed" },
];

const TEMPLATE_OPTIONS = [
  { value: "instagram-reel", label: "Instagram Reel", description: "Pre-configured with tracks for video, text, and audio" },
  { value: "empty", label: "Blank Project", description: "Start from scratch with no tracks" },
] as const;

export const NewProjectDialog: React.FC = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [template, setTemplate] = useState<"empty" | "instagram-reel">("instagram-reel");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled Project",
          aspectRatio,
          template,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      }

      const project = await res.json();
      setOpen(false);
      setTitle("");
      router.push(`/editor/${project.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Choose a template and aspect ratio for your video project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Awesome Video"
              disabled={isCreating}
            />
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAspectRatio(option.value)}
                  disabled={isCreating}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    aspectRatio === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-mono text-sm font-semibold">
                    {option.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Template</label>
            <div className="space-y-2">
              {TEMPLATE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTemplate(option.value)}
                  disabled={isCreating}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    template === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Project"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
