/**
 * Editor Page
 *
 * Main editor view for a specific project.
 * Loads the project from the API, shows loading/error states,
 * and passes the loaded project to EditorLayout.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";

import { EditorLayout } from "@/components/editor/EditorLayout";
import { useEditorStore } from "@/stores/editor-store";
import { useChatStore } from "@/stores/chat-store";
import type { VideoProject } from "@/lib/schema/video-schema";
import { Button } from "@/components/ui/button";

type LoadState = "loading" | "ready" | "error" | "not-found";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const loadProject = useEditorStore((s) => s.loadProject);
  const clearMessages = useChatStore((s) => s.clearMessages);

  useEffect(() => {
    if (!projectId) {
      setLoadState("error");
      setErrorMessage("No project ID provided");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        // Load project and chat messages in parallel
        const [projectRes, chatRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/projects/${projectId}/chat`),
        ]);

        if (cancelled) return;

        if (projectRes.status === 404) {
          setLoadState("not-found");
          return;
        }

        if (!projectRes.ok) {
          throw new Error(`HTTP ${projectRes.status}`);
        }

        const data = await projectRes.json();
        const projectData = data.projectData as VideoProject;

        if (!projectData) {
          throw new Error("Project data is missing");
        }

        // Load the project into the editor store
        loadProject(projectId, projectData);

        // Load persisted chat messages or reset for a fresh session
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          if (chatData.messages && chatData.messages.length > 0) {
            // Restore persisted chat
            useChatStore.getState().clearMessages();
            for (const msg of chatData.messages) {
              useChatStore.getState().addMessage(msg);
            }
          } else {
            clearMessages();
          }
        } else {
          clearMessages();
        }

        setLoadState("ready");
      } catch (err: unknown) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Failed to load project");
        setLoadState("error");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject, clearMessages]);

  if (loadState === "loading") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (loadState === "not-found") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-semibold">Project Not Found</h1>
        <p className="text-sm text-muted-foreground">
          The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h1 className="text-xl font-semibold">Failed to Load Project</h1>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return <EditorLayout />;
}
