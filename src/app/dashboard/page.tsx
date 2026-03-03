/**
 * Dashboard Page
 *
 * Grid of project cards with a "New Project" button.
 * Fetches projects from GET /api/projects.
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Loader2, FolderOpen } from "lucide-react";

import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { NewProjectDialog } from "@/components/dashboard/NewProjectDialog";
import type { VideoProject } from "@/lib/schema/video-schema";

interface ProjectItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  projectData: VideoProject;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your video projects
          </p>
        </div>
        <NewProjectDialog />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <button
            onClick={fetchProjects}
            className="text-sm text-primary underline"
          >
            Try again
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <h3 className="font-medium mb-1">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first project to get started
          </p>
          <NewProjectDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              title={project.title}
              description={project.description}
              status={project.status}
              projectData={project.projectData}
              createdAt={new Date(project.createdAt)}
              updatedAt={new Date(project.updatedAt)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
