/**
 * Session Store (Database Operations)
 *
 * CRUD operations for AI sessions and session events in PostgreSQL.
 * Sessions are conversation threads scoped to a project.
 */

import { eq, desc, and, sql } from "drizzle-orm";

import { db } from "./db";
import {
  aiSessions,
  sessionEvents,
  type AiSession,
  type SessionEvent,
} from "./db-schema";

// ─── Sessions ───────────────────────────────────────────────────────

export async function createSession(
  projectId: string,
  userId: string,
  title?: string,
  providerId?: string,
  modelId?: string
): Promise<AiSession> {
  const [session] = await db
    .insert(aiSessions)
    .values({
      projectId,
      userId,
      title: title ?? "New Session",
      providerId: providerId ?? null,
      modelId: modelId ?? null,
      messages: [],
    })
    .returning();

  return session;
}

export async function getSession(
  sessionId: string,
  userId: string
): Promise<AiSession | null> {
  const [session] = await db
    .select()
    .from(aiSessions)
    .where(and(eq(aiSessions.id, sessionId), eq(aiSessions.userId, userId)))
    .limit(1);

  return session ?? null;
}

export async function listSessions(
  projectId: string,
  userId: string
): Promise<AiSession[]> {
  return db
    .select()
    .from(aiSessions)
    .where(
      and(
        eq(aiSessions.projectId, projectId),
        eq(aiSessions.userId, userId),
        eq(aiSessions.status, "active")
      )
    )
    .orderBy(desc(aiSessions.updatedAt));
}

export async function updateSession(
  sessionId: string,
  userId: string,
  updates: {
    title?: string;
    messages?: unknown[];
    continuationState?: unknown;
    status?: string;
    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalThinkingTokens?: number;
    totalIterations?: number;
  }
): Promise<AiSession | null> {
  const setValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (updates.title !== undefined) setValues.title = updates.title;
  if (updates.messages !== undefined) setValues.messages = updates.messages;
  if (updates.continuationState !== undefined) setValues.continuationState = updates.continuationState;
  if (updates.status !== undefined) setValues.status = updates.status;
  if (updates.totalInputTokens !== undefined) setValues.totalInputTokens = updates.totalInputTokens;
  if (updates.totalOutputTokens !== undefined) setValues.totalOutputTokens = updates.totalOutputTokens;
  if (updates.totalThinkingTokens !== undefined) setValues.totalThinkingTokens = updates.totalThinkingTokens;
  if (updates.totalIterations !== undefined) setValues.totalIterations = updates.totalIterations;

  const [session] = await db
    .update(aiSessions)
    .set(setValues)
    .where(and(eq(aiSessions.id, sessionId), eq(aiSessions.userId, userId)))
    .returning();

  return session ?? null;
}

export async function deleteSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .update(aiSessions)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(and(eq(aiSessions.id, sessionId), eq(aiSessions.userId, userId)))
    .returning({ id: aiSessions.id });

  return result.length > 0;
}

/** Increment token usage atomically */
export async function incrementSessionTokens(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number,
  iterations: number
): Promise<void> {
  await db
    .update(aiSessions)
    .set({
      totalInputTokens: sql`${aiSessions.totalInputTokens} + ${inputTokens}`,
      totalOutputTokens: sql`${aiSessions.totalOutputTokens} + ${outputTokens}`,
      totalThinkingTokens: sql`${aiSessions.totalThinkingTokens} + ${thinkingTokens}`,
      totalIterations: sql`${aiSessions.totalIterations} + ${iterations}`,
      updatedAt: new Date(),
    })
    .where(eq(aiSessions.id, sessionId));
}

// ─── Session Events ─────────────────────────────────────────────────

export async function logSessionEvent(
  sessionId: string,
  type: string,
  payload: Record<string, unknown> = {},
  tokenUsage?: { input?: number; output?: number; thinking?: number },
  durationMs?: number
): Promise<SessionEvent> {
  const [event] = await db
    .insert(sessionEvents)
    .values({
      sessionId,
      type,
      payload,
      inputTokens: tokenUsage?.input ?? null,
      outputTokens: tokenUsage?.output ?? null,
      thinkingTokens: tokenUsage?.thinking ?? null,
      durationMs: durationMs ?? null,
    })
    .returning();

  return event;
}

export async function listSessionEvents(
  sessionId: string,
  limit = 100
): Promise<SessionEvent[]> {
  return db
    .select()
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(desc(sessionEvents.createdAt))
    .limit(limit);
}
