/**
 * Database Schema (Drizzle ORM)
 *
 * Defines the PostgreSQL tables for persisting projects,
 * assets, chat history, auth, and project versions.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

// ─── Auth Tables (better-auth) ──────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ─── Projects Table ─────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull().default("Untitled Project"),
  description: text("description").default(""),

  /** Owner — references the better-auth users table */
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  /**
   * The full VideoProject JSON schema.
   * Stored as JSONB for queryability.
   */
  projectData: jsonb("project_data").notNull(),

  /** Thumbnail URL (S3) */
  thumbnailUrl: text("thumbnail_url"),

  /** Project status */
  status: varchar("status", { length: 50 }).notNull().default("draft"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Project Versions Table ─────────────────────────────────────────

export const projectVersions = pgTable("project_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),

  /** Full VideoProject JSON snapshot */
  projectData: jsonb("project_data").notNull(),

  /** Chat messages snapshot at the time of this version */
  chatSnapshot: jsonb("chat_snapshot"),

  /** Who created this version */
  createdBy: varchar("created_by", { length: 20 }).notNull().default("user"), // "user" | "agent"

  /** Description of what changed */
  description: text("description").default(""),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Assets Table ───────────────────────────────────────────────────

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),

  /** Asset type: video, image, audio, generated */
  type: varchar("type", { length: 50 }).notNull(),

  /** Source: upload, stock, ai-generated, url */
  source: varchar("source", { length: 50 }).notNull(),

  /** Original filename */
  filename: varchar("filename", { length: 500 }),

  /** MIME type */
  mimeType: varchar("mime_type", { length: 100 }),

  /** S3 key for the stored file */
  s3Key: text("s3_key").notNull(),

  /** Public URL for the asset */
  url: text("url").notNull(),

  /** File size in bytes */
  fileSize: integer("file_size"),

  /** Duration in seconds (for video/audio) */
  duration: integer("duration"),

  /** Width in pixels (for video/image) */
  width: integer("width"),

  /** Height in pixels (for video/image) */
  height: integer("height"),

  /** Additional metadata */
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Chat History Table ─────────────────────────────────────────────

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),

  role: varchar("role", { length: 20 }).notNull(), // user, assistant, system
  content: text("content").notNull(),

  /** Tool calls made during this message */
  toolCalls: jsonb("tool_calls"),

  /** Block-based content for assistant messages */
  blocks: jsonb("blocks"),

  /** Agent run summary */
  summary: jsonb("summary"),

  /** Order within the conversation */
  orderIndex: integer("order_index").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Render Jobs Table ──────────────────────────────────────────────

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),

  /** Status: pending, rendering, completed, failed */
  status: varchar("status", { length: 50 }).notNull().default("pending"),

  /** S3 key for the rendered output */
  outputS3Key: text("output_s3_key"),

  /** Public URL for the rendered video */
  outputUrl: text("output_url"),

  /** Rendering progress (0-100) */
  progress: integer("progress").default(0),

  /** Error message if failed */
  errorMessage: text("error_message"),

  /** Rendering configuration */
  config: jsonb("config"),

  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── AI Sessions Table ──────────────────────────────────────────────
// Like OpenCode sessions — each is a conversation thread about a project.
// Distinct from the better-auth "sessions" table above.

export const aiSessions = pgTable("ai_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  /** Display title (auto-generated from first message or manual) */
  title: varchar("title", { length: 500 }).notNull().default("New Session"),

  /** Session status */
  status: varchar("status", { length: 20 }).notNull().default("active"), // active | archived | deleted

  /** Provider used for this session */
  providerId: varchar("provider_id", { length: 50 }), // anthropic | openai | gemini | copilot

  /** Model used for this session */
  modelId: varchar("model_id", { length: 100 }), // claude-sonnet-4-20250514, gpt-4o, etc.

  /** Full chat messages snapshot (block-based) */
  messages: jsonb("messages").notNull().default([]),

  /** Continuation state for paused agent runs */
  continuationState: jsonb("continuation_state"),

  /** Aggregate token usage */
  totalInputTokens: integer("total_input_tokens").notNull().default(0),
  totalOutputTokens: integer("total_output_tokens").notNull().default(0),
  totalThinkingTokens: integer("total_thinking_tokens").notNull().default(0),

  /** Number of agent iterations across all runs in this session */
  totalIterations: integer("total_iterations").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Session Events Table ───────────────────────────────────────────
// Comprehensive logging of every interaction within a session.

export const sessionEvents = pgTable("session_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => aiSessions.id, { onDelete: "cascade" }),

  /** Event type */
  type: varchar("type", { length: 50 }).notNull(),
  // Types: message_sent, message_received, tool_call, tool_result,
  //        project_updated, error, rate_limit, agent_started, agent_done,
  //        agent_paused, agent_continued, session_created, session_archived

  /** Event payload (varies by type) */
  payload: jsonb("payload").notNull().default({}),

  /** Token usage for this specific event (if applicable) */
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  thinkingTokens: integer("thinking_tokens"),

  /** Duration in ms (for tool calls, agent runs) */
  durationMs: integer("duration_ms"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Provider Configs Table ─────────────────────────────────────────
// Per-user provider configuration. Users can set API keys and default models.

export const providerConfigs = pgTable("provider_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  /** Provider identifier: anthropic | openai | gemini | copilot */
  providerId: varchar("provider_id", { length: 50 }).notNull(),

  /** Display name for this config */
  displayName: varchar("display_name", { length: 100 }),

  /** API key (encrypted at rest ideally, plaintext for now) */
  apiKey: text("api_key"),

  /** OAuth tokens (for Copilot device code flow, ChatGPT Plus, etc.) */
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),

  /** Default model for this provider */
  defaultModel: varchar("default_model", { length: 100 }),

  /** Whether this provider is enabled */
  enabled: boolean("enabled").notNull().default(true),

  /** Extra settings (temperature, max tokens, etc.) */
  settings: jsonb("settings").default({}),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Type Exports ───────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectVersion = typeof projectVersions.$inferSelect;
export type NewProjectVersion = typeof projectVersions.$inferInsert;
export type AssetRecord = typeof assets.$inferSelect;
export type NewAssetRecord = typeof assets.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type RenderJob = typeof renderJobs.$inferSelect;
export type NewRenderJob = typeof renderJobs.$inferInsert;
export type AiSession = typeof aiSessions.$inferSelect;
export type NewAiSession = typeof aiSessions.$inferInsert;
export type SessionEvent = typeof sessionEvents.$inferSelect;
export type NewSessionEvent = typeof sessionEvents.$inferInsert;
export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type NewProviderConfig = typeof providerConfigs.$inferInsert;
