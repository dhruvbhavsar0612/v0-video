/**
 * Version Detail API Route
 *
 * GET  /api/projects/[projectId]/versions/[versionId] — Get specific version
 * POST /api/projects/[projectId]/versions/[versionId] — Restore this version
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import {
  getProjectForUser,
  getVersion,
  restoreVersion,
  createVersion,
} from "@/lib/storage/project-store";
import type { VideoProject } from "@/lib/schema/video-schema";

type RouteContext = {
  params: Promise<{ projectId: string; versionId: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, versionId } = await context.params;

  // Verify ownership
  const project = await getProjectForUser(projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const version = await getVersion(versionId);
  if (!version || version.projectId !== projectId) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json(version);
}

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, versionId } = await context.params;

  // Verify ownership
  const existingProject = await getProjectForUser(projectId, session.user.id);
  if (!existingProject) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const version = await getVersion(versionId);
  if (!version || version.projectId !== projectId) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Restore the version (updates the project's current state)
  const restored = await restoreVersion(versionId, session.user.id);
  if (!restored) {
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }

  // Create a new version snapshot marking this as a restore
  await createVersion(
    projectId,
    version.projectData as VideoProject,
    "user",
    `Restored from v${version.versionNumber}`
  );

  return NextResponse.json(restored);
}
