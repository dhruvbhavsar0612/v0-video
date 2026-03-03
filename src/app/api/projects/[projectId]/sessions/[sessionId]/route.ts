/**
 * Session Detail API
 *
 * GET    /api/projects/[projectId]/sessions/[sessionId] — Get session details
 * PUT    /api/projects/[projectId]/sessions/[sessionId] — Update session
 * DELETE /api/projects/[projectId]/sessions/[sessionId] — Archive/delete session
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import {
  getSession,
  updateSession,
  deleteSession,
} from "@/lib/storage/session-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const aiSession = await getSession(sessionId, session.user.id);

  if (!aiSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(aiSession);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const body = await req.json();

  const aiSession = await updateSession(sessionId, session.user.id, body);

  if (!aiSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(aiSession);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const deleted = await deleteSession(sessionId, session.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
