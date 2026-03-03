/**
 * Project Store (Database Operations)
 *
 * CRUD operations for projects and versions in PostgreSQL.
 * Follows the repository pattern.
 */

import { eq, desc, and, sql } from "drizzle-orm";

import { db } from "./db";
import {
  projects,
  projectVersions,
  type Project,
  type ProjectVersion,
} from "./db-schema";
import type { VideoProject } from "@/lib/schema/video-schema";

// ─── Create ─────────────────────────────────────────────────────────

export async function createProject(
  videoProject: VideoProject,
  userId: string
): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({
      id: videoProject.id,
      title: videoProject.metadata.title,
      description: videoProject.metadata.description,
      projectData: videoProject,
      userId,
      status: "draft",
    })
    .returning();

  return project;
}

// ─── Read ───────────────────────────────────────────────────────────

export async function getProject(id: string): Promise<Project | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  return project ?? null;
}

export async function getProjectForUser(
  id: string,
  userId: string
): Promise<Project | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  return project ?? null;
}

export async function listProjects(userId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
}

// ─── Update ─────────────────────────────────────────────────────────

export async function updateProject(
  id: string,
  videoProject: VideoProject,
  userId: string
): Promise<Project | null> {
  const [project] = await db
    .update(projects)
    .set({
      title: videoProject.metadata.title,
      description: videoProject.metadata.description,
      projectData: videoProject,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();

  return project ?? null;
}

export async function updateProjectStatus(
  id: string,
  status: string
): Promise<void> {
  await db
    .update(projects)
    .set({ status, updatedAt: new Date() })
    .where(eq(projects.id, id));
}

// ─── Delete ─────────────────────────────────────────────────────────

export async function deleteProject(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning({ id: projects.id });

  return result.length > 0;
}

// ─── Versions ───────────────────────────────────────────────────────

export async function createVersion(
  projectId: string,
  projectData: VideoProject,
  createdBy: "user" | "agent" = "user",
  description: string = "",
  chatSnapshot?: unknown
): Promise<ProjectVersion> {
  // Get next version number
  const [maxVersion] = await db
    .select({ max: sql<number>`COALESCE(MAX(${projectVersions.versionNumber}), 0)` })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId));

  const versionNumber = (maxVersion?.max ?? 0) + 1;

  const [version] = await db
    .insert(projectVersions)
    .values({
      projectId,
      versionNumber,
      projectData,
      chatSnapshot,
      createdBy,
      description,
    })
    .returning();

  return version;
}

export async function listVersions(
  projectId: string
): Promise<ProjectVersion[]> {
  return db
    .select()
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.versionNumber));
}

export async function getVersion(
  versionId: string
): Promise<ProjectVersion | null> {
  const [version] = await db
    .select()
    .from(projectVersions)
    .where(eq(projectVersions.id, versionId))
    .limit(1);

  return version ?? null;
}

export async function restoreVersion(
  versionId: string,
  userId: string
): Promise<Project | null> {
  const version = await getVersion(versionId);
  if (!version) return null;

  const projectData = version.projectData as VideoProject;

  const [project] = await db
    .update(projects)
    .set({
      projectData,
      title: projectData.metadata.title,
      description: projectData.metadata.description,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, version.projectId), eq(projects.userId, userId)))
    .returning();

  return project ?? null;
}
