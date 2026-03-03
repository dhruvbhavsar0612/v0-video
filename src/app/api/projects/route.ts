/**
 * Projects API Route
 *
 * GET  /api/projects — List user's projects
 * POST /api/projects — Create a new project
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import {
  createProject,
  listProjects,
  createVersion,
} from "@/lib/storage/project-store";
import {
  createEmptyProject,
  createInstagramReelsTemplate,
} from "@/lib/schema/schema-defaults";
import type { AspectRatio } from "@/lib/schema/video-schema";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await listProjects(session.user.id);
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, aspectRatio, template } = body as {
      title?: string;
      aspectRatio?: AspectRatio;
      template?: "empty" | "instagram-reel";
    };

    // Create VideoProject from template
    const videoProject =
      template === "empty"
        ? createEmptyProject({
            metadata: {
              title: title || "Untitled Project",
              aspectRatio: aspectRatio || "9:16",
            },
          })
        : createInstagramReelsTemplate(title || "Untitled Reel");

    // If aspect ratio was specified and using the reel template, override it
    if (aspectRatio && template !== "empty") {
      videoProject.metadata.aspectRatio = aspectRatio;
    }

    // Save to DB
    const project = await createProject(videoProject, session.user.id);

    // Create initial version snapshot (v1)
    await createVersion(
      project.id,
      videoProject,
      "user",
      "Initial project"
    );

    return NextResponse.json(project, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
