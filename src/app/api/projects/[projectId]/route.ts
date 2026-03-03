/**
 * Project Detail API Route
 *
 * GET    /api/projects/[projectId] — Get project (with ownership check)
 * PUT    /api/projects/[projectId] — Update project
 * DELETE /api/projects/[projectId] — Delete project
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import {
  getProjectForUser,
  updateProject,
  deleteProject,
} from "@/lib/storage/project-store";
import type { VideoProject } from "@/lib/schema/video-schema";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const project = await getProjectForUser(projectId, session.user.id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    const body = await request.json();
    const videoProject = body.projectData as VideoProject;

    if (!videoProject) {
      return NextResponse.json(
        { error: "Missing projectData" },
        { status: 400 }
      );
    }

    const project = await updateProject(
      projectId,
      videoProject,
      session.user.id
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const deleted = await deleteProject(projectId, session.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
