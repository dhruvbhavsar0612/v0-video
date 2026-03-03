/**
 * Chat Messages API Route
 *
 * GET  /api/projects/[projectId]/chat — Load persisted chat messages
 * POST /api/projects/[projectId]/chat — Save chat messages (full snapshot)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import { getProjectForUser } from "@/lib/storage/project-store";
import {
  loadChatMessages,
  saveChatMessages,
} from "@/lib/storage/chat-store-db";

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

  const messages = await loadChatMessages(projectId);
  return NextResponse.json({ messages });
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
    const { messages } = body;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing or invalid messages array" },
        { status: 400 }
      );
    }

    await saveChatMessages(projectId, messages);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
