/**
 * Session List + Create API
 *
 * GET  /api/projects/[projectId]/sessions — List sessions for a project
 * POST /api/projects/[projectId]/sessions — Create a new session
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import { createSession, listSessions, logSessionEvent } from "@/lib/storage/session-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const sessions = await listSessions(projectId, session.user.id);

  return NextResponse.json(sessions);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const body = await req.json();
  const { title, providerId, modelId } = body;

  const aiSession = await createSession(
    projectId,
    session.user.id,
    title,
    providerId,
    modelId
  );

  // Log session creation event
  await logSessionEvent(aiSession.id, "session_created", {
    projectId,
    title: aiSession.title,
    providerId: providerId ?? null,
    modelId: modelId ?? null,
  });

  return NextResponse.json(aiSession, { status: 201 });
}
