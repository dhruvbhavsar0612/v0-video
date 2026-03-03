/**
 * Version List API Route
 *
 * GET  /api/projects/[projectId]/versions — List versions
 * POST /api/projects/[projectId]/versions — Create version snapshot
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import {
  getProjectForUser,
  createVersion,
  listVersions,
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

  // Verify ownership
  const project = await getProjectForUser(projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const versions = await listVersions(projectId);
  return NextResponse.json(versions);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  // Verify ownership
  const project = await getProjectForUser(projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      projectData,
      createdBy = "user",
      description = "",
      chatSnapshot,
    } = body as {
      projectData: VideoProject;
      createdBy?: "user" | "agent";
      description?: string;
      chatSnapshot?: unknown;
    };

    if (!projectData) {
      return NextResponse.json(
        { error: "Missing projectData" },
        { status: 400 }
      );
    }

    const version = await createVersion(
      projectId,
      projectData,
      createdBy,
      description,
      chatSnapshot
    );

    return NextResponse.json(version, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
