/**
 * Chat Store DB
 *
 * Persists chat messages to/from PostgreSQL for a given project.
 * Each message is stored as a row in the chatMessages table with
 * its blocks, summary, and order index.
 */

import { db } from "@/lib/storage/db";
import { chatMessages } from "@/lib/storage/db-schema";
import { eq, asc } from "drizzle-orm";
import type { ChatMessage as StoreChatMessage } from "@/stores/chat-store";

// ─── Save Chat Messages ─────────────────────────────────────────────

/**
 * Persist the current chat messages for a project.
 * Replaces all existing messages for the project (full snapshot approach).
 */
export async function saveChatMessages(
  projectId: string,
  messages: StoreChatMessage[]
): Promise<void> {
  // Delete existing messages for this project
  await db.delete(chatMessages).where(eq(chatMessages.projectId, projectId));

  // Insert all current messages
  if (messages.length === 0) return;

  const rows = messages.map((msg, index) => ({
    projectId,
    role: msg.role,
    content: msg.content,
    blocks: msg.blocks ? (msg.blocks as unknown as Record<string, unknown>[]) : null,
    summary: msg.summary ? (msg.summary as unknown as Record<string, unknown>) : null,
    toolCalls: msg.toolCalls ? (msg.toolCalls as unknown as Record<string, unknown>[]) : null,
    orderIndex: index,
  }));

  await db.insert(chatMessages).values(rows);
}

// ─── Load Chat Messages ─────────────────────────────────────────────

/**
 * Load persisted chat messages for a project, ordered by orderIndex.
 * Returns them in the format expected by the chat store.
 */
export async function loadChatMessages(
  projectId: string
): Promise<StoreChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(asc(chatMessages.orderIndex));

  return rows.map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
    blocks: (row.blocks as StoreChatMessage["blocks"]) ?? undefined,
    summary: (row.summary as StoreChatMessage["summary"]) ?? undefined,
    toolCalls: (row.toolCalls as StoreChatMessage["toolCalls"]) ?? undefined,
    timestamp: row.createdAt.toISOString(),
  }));
}
