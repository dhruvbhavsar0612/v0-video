/**
 * Provider Config Store (Database Operations)
 *
 * CRUD operations for AI provider configurations.
 * Each user can configure multiple providers (Anthropic, OpenAI, Gemini, Copilot).
 */

import { eq, and } from "drizzle-orm";

import { db } from "./db";
import {
  providerConfigs,
  type ProviderConfig,
} from "./db-schema";

// ─── Provider Definitions ───────────────────────────────────────────

export interface ProviderDefinition {
  id: string;
  name: string;
  description: string;
  models: { id: string; name: string; description: string }[];
  authType: "api_key" | "oauth" | "env";
  envKey?: string; // Environment variable name for fallback
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models with extended thinking",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Best balance of speed and quality" },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4", description: "Most capable model" },
      { id: "claude-haiku-35-20241022", name: "Claude 3.5 Haiku", description: "Fastest response times" },
    ],
    authType: "api_key",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o and o-series models",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Versatile multimodal model" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and affordable" },
      { id: "o3", name: "o3", description: "Advanced reasoning model" },
    ],
    authType: "api_key",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini models with long context",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast with thinking" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Most capable Gemini" },
    ],
    authType: "api_key",
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    description: "Use your Copilot subscription",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4 (via Copilot)", description: "Anthropic via GitHub" },
      { id: "gpt-4o", name: "GPT-4o (via Copilot)", description: "OpenAI via GitHub" },
    ],
    authType: "oauth",
  },
];

// ─── CRUD Operations ────────────────────────────────────────────────

export async function getProviderConfigs(
  userId: string
): Promise<ProviderConfig[]> {
  return db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.userId, userId));
}

export async function getProviderConfig(
  userId: string,
  providerId: string
): Promise<ProviderConfig | null> {
  const [config] = await db
    .select()
    .from(providerConfigs)
    .where(
      and(
        eq(providerConfigs.userId, userId),
        eq(providerConfigs.providerId, providerId)
      )
    )
    .limit(1);

  return config ?? null;
}

export async function upsertProviderConfig(
  userId: string,
  providerId: string,
  updates: {
    apiKey?: string | null;
    defaultModel?: string | null;
    enabled?: boolean;
    displayName?: string | null;
    settings?: Record<string, unknown>;
    accessToken?: string | null;
    refreshToken?: string | null;
    tokenExpiresAt?: Date | null;
  }
): Promise<ProviderConfig> {
  const existing = await getProviderConfig(userId, providerId);

  if (existing) {
    const [config] = await db
      .update(providerConfigs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(providerConfigs.id, existing.id))
      .returning();
    return config;
  }

  const [config] = await db
    .insert(providerConfigs)
    .values({
      userId,
      providerId,
      apiKey: updates.apiKey ?? null,
      defaultModel: updates.defaultModel ?? null,
      enabled: updates.enabled ?? true,
      displayName: updates.displayName ?? null,
      settings: updates.settings ?? {},
      accessToken: updates.accessToken ?? null,
      refreshToken: updates.refreshToken ?? null,
      tokenExpiresAt: updates.tokenExpiresAt ?? null,
    })
    .returning();

  return config;
}

export async function deleteProviderConfig(
  userId: string,
  providerId: string
): Promise<boolean> {
  const result = await db
    .delete(providerConfigs)
    .where(
      and(
        eq(providerConfigs.userId, userId),
        eq(providerConfigs.providerId, providerId)
      )
    )
    .returning({ id: providerConfigs.id });

  return result.length > 0;
}

/**
 * Resolve the API key for a given provider.
 * Priority: user config > environment variable
 */
export async function resolveApiKey(
  userId: string,
  providerId: string
): Promise<string | null> {
  const config = await getProviderConfig(userId, providerId);
  if (config?.apiKey) return config.apiKey;

  // Fallback to environment variable
  const providerDef = PROVIDERS.find((p) => p.id === providerId);
  if (providerDef?.envKey) {
    return process.env[providerDef.envKey] ?? null;
  }

  return null;
}
