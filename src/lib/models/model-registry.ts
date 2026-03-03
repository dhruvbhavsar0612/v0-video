/**
 * Model Registry
 *
 * Provides a comprehensive list of available AI models for each provider.
 * Static models serve as reliable fallbacks; live fetching is used for
 * providers with model listing APIs (Gemini, OpenAI).
 */

import { GoogleGenAI } from "@google/genai";

// ─── Types ──────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  /** Whether this is a featured/recommended model */
  featured?: boolean;
  /** Max context window in tokens */
  contextWindow?: number;
  /** Supports extended thinking / reasoning */
  supportsThinking?: boolean;
  /** Supports image inputs */
  supportsVision?: boolean;
}

export interface ProviderModels {
  providerId: string;
  models: ModelInfo[];
  /** True if this came from live API, false if static fallback */
  fromLiveApi: boolean;
  /** When these models were fetched */
  fetchedAt: number;
}

// ─── Static Model Registry ───────────────────────────────────────────

export const STATIC_MODELS: Record<string, ModelInfo[]> = {
  anthropic: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude Sonnet 4",
      description: "Best balance of speed, quality and intelligence",
      featured: true,
      contextWindow: 200000,
      supportsThinking: true,
      supportsVision: true,
    },
    {
      id: "claude-opus-4-20250514",
      name: "Claude Opus 4",
      description: "Most capable Claude model for complex tasks",
      featured: true,
      contextWindow: 200000,
      supportsThinking: true,
      supportsVision: true,
    },
    {
      id: "claude-haiku-35-20241022",
      name: "Claude 3.5 Haiku",
      description: "Fastest Claude model — best for high-throughput tasks",
      contextWindow: 200000,
      supportsVision: true,
    },
    {
      id: "claude-3-7-sonnet-20250219",
      name: "Claude 3.7 Sonnet",
      description: "Previous generation Sonnet with hybrid reasoning",
      contextWindow: 200000,
      supportsThinking: true,
      supportsVision: true,
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Reliable, balanced model",
      contextWindow: 200000,
      supportsVision: true,
    },
  ],

  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      description: "Versatile flagship model with vision and fast speed",
      featured: true,
      contextWindow: 128000,
      supportsVision: true,
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      description: "Affordable and fast for simpler tasks",
      contextWindow: 128000,
      supportsVision: true,
    },
    {
      id: "o3",
      name: "o3",
      description: "Most intelligent OpenAI model with deep reasoning",
      featured: true,
      contextWindow: 200000,
      supportsThinking: true,
    },
    {
      id: "o4-mini",
      name: "o4-mini",
      description: "Fast reasoning model, cost-effective",
      contextWindow: 200000,
      supportsThinking: true,
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      description: "Legacy GPT-4 Turbo model",
      contextWindow: 128000,
      supportsVision: true,
    },
  ],

  gemini: [
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      description: "Google's most capable model with deep reasoning",
      featured: true,
      contextWindow: 1000000,
      supportsThinking: true,
      supportsVision: true,
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "Fast model with thinking capabilities",
      featured: true,
      contextWindow: 1000000,
      supportsThinking: true,
      supportsVision: true,
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      description: "Multimodal model with native image generation",
      contextWindow: 1000000,
      supportsVision: true,
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      description: "Long context model, up to 2M tokens",
      contextWindow: 2000000,
      supportsVision: true,
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      description: "Fast and efficient for high-frequency tasks",
      contextWindow: 1000000,
      supportsVision: true,
    },
  ],

  copilot: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude Sonnet 4 (via Copilot)",
      description: "Anthropic Claude via GitHub Copilot subscription",
      featured: true,
    },
    {
      id: "gpt-4o",
      name: "GPT-4o (via Copilot)",
      description: "OpenAI GPT-4o via GitHub Copilot subscription",
    },
    {
      id: "o3",
      name: "o3 (via Copilot)",
      description: "OpenAI o3 reasoning model via GitHub Copilot",
    },
  ],
};

// ─── Live Model Fetching ─────────────────────────────────────────────

/** Simple in-memory cache: provider → { models, fetchedAt } */
const modelCache = new Map<string, ProviderModels>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch live Gemini models from the Google API.
 */
async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    // The listModels method is on ai.models
    const response = await (ai as unknown as { models: { list: () => Promise<{ page: Array<{ name: string; displayName?: string; description?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }> }> } }).models.list();
    const items = response.page ?? [];

    return items
      .filter((m) => {
        // Only include text generation models (not embedding/aqa)
        const methods = m.supportedGenerationMethods ?? [];
        return (
          methods.includes("generateContent") &&
          m.name?.includes("gemini")
        );
      })
      .map((m) => {
        const shortName = m.name?.replace("models/", "") ?? "";
        // Merge with static info if available
        const staticInfo = STATIC_MODELS.gemini?.find((s) => s.id === shortName);
        return {
          id: shortName,
          name: m.displayName ?? staticInfo?.name ?? shortName,
          description: m.description ?? staticInfo?.description ?? "",
          featured: staticInfo?.featured,
          contextWindow: m.inputTokenLimit ?? staticInfo?.contextWindow,
          supportsThinking: staticInfo?.supportsThinking,
          supportsVision: staticInfo?.supportsVision,
        };
      })
      .sort((a, b) => {
        // Featured first, then alphabetical
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

/**
 * Fetch live Anthropic models from the Anthropic API.
 */
async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      data: Array<{ id: string; display_name: string; created_at: string; type: string }>;
    };
    const items = data.data ?? [];

    return items
      .filter((m) => m.type === "model")
      .map((m) => {
        const staticInfo = STATIC_MODELS.anthropic?.find((s) => s.id === m.id);
        return {
          id: m.id,
          name: m.display_name ?? staticInfo?.name ?? m.id,
          description: staticInfo?.description ?? "",
          featured: staticInfo?.featured,
          contextWindow: staticInfo?.contextWindow,
          supportsThinking: staticInfo?.supportsThinking ?? (m.id.includes("opus") || m.id.includes("sonnet")),
          supportsVision: staticInfo?.supportsVision ?? true,
        };
      })
      .sort((a, b) => {
        // Featured first, then by model name descending (newest first)
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return b.id.localeCompare(a.id);
      });
  } catch {
    return [];
  }
}

/**
 * Fetch live OpenAI models.
 * Uses pattern-based filtering so new model families (gpt-5, o5, etc.)
 * are automatically included without needing a hardcoded allowlist.
 */
async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) return [];

    const data = await response.json() as { data: Array<{ id: string; created: number }> };
    const allModels = data.data ?? [];

    // Exclude non-chat model families: embeddings, tts, whisper, dall-e, moderation, etc.
    const excludePatterns = [
      /^text-embedding/,
      /^text-moderation/,
      /^text-search/,
      /^text-similarity/,
      /^code-search/,
      /^whisper/,
      /^tts/,
      /^dall-e/,
      /^davinci/,
      /^babbage/,
      /^ada/,
      /^curie/,
      /^omni-moderation/,
      /^chatgpt-4o-latest/,   // alias — exclude to avoid confusion
    ];

    return allModels
      .filter((m) => {
        // Must look like a chat/reasoning model
        const isChat =
          m.id.startsWith("gpt-") ||
          /^o\d/.test(m.id); // o1, o2, o3, o4, o5…
        const isExcluded = excludePatterns.some((re) => re.test(m.id));
        return isChat && !isExcluded;
      })
      .map((m) => {
        const staticInfo = STATIC_MODELS.openai?.find((s) => s.id === m.id);
        return {
          id: m.id,
          name: staticInfo?.name ?? m.id,
          description: staticInfo?.description ?? "",
          featured: staticInfo?.featured,
          contextWindow: staticInfo?.contextWindow,
          supportsThinking: staticInfo?.supportsThinking ?? /^o\d/.test(m.id),
          supportsVision: staticInfo?.supportsVision ?? m.id.startsWith("gpt-"),
        };
      })
      .sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        // Newer models first (higher `created` timestamp = newer)
        return b.id.localeCompare(a.id);
      });
  } catch {
    return [];
  }
}

/**
 * Fetch live Copilot models from the GitHub Copilot API.
 * Uses the OpenAI-compatible GET /models endpoint on api.githubcopilot.com.
 * Requires a Copilot session token (NOT the GitHub OAuth token).
 */
async function fetchCopilotModels(sessionToken: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch("https://api.githubcopilot.com/models", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        Accept: "application/json",
        "Copilot-Integration-Id": "vscode-chat",
        "Editor-Version": "vscode/1.100.0",
        "Editor-Plugin-Version": "copilot-chat/0.25.0",
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        name?: string;
        version?: string;
        capabilities?: {
          family?: string;
          type?: string;
          tokenizer?: string;
          limits?: { max_prompt_tokens?: number; max_output_tokens?: number };
        };
      }>;
    };

    const items = data.data ?? [];

    return items
      .filter((m) => {
        // Only include chat-capable models (not embeddings, etc.)
        const type = m.capabilities?.type ?? "";
        return type === "chat" || type === "" || !type;
      })
      .map((m) => {
        const family = m.capabilities?.family ?? "";
        const maxPrompt = m.capabilities?.limits?.max_prompt_tokens;

        // Determine capabilities from model id/family
        const isReasoning =
          /^o\d/.test(m.id) || family.includes("o1") || family.includes("o3") || family.includes("o4");
        const isClaude = m.id.includes("claude");
        const isGpt = m.id.startsWith("gpt-");
        const isGemini = m.id.includes("gemini");

        // Check static models for extra metadata
        const staticInfo = STATIC_MODELS.copilot?.find((s) => s.id === m.id);

        return {
          id: m.id,
          name: m.name
            ? `${m.name} (via Copilot)`
            : staticInfo?.name ?? `${m.id} (via Copilot)`,
          description:
            staticInfo?.description ??
            `${isClaude ? "Anthropic" : isGpt ? "OpenAI" : isGemini ? "Google" : ""} model via GitHub Copilot`.trim(),
          featured: staticInfo?.featured ?? (m.id.includes("sonnet-4") || m.id === "gpt-4o" || m.id === "o3"),
          contextWindow: maxPrompt ?? staticInfo?.contextWindow,
          supportsThinking:
            staticInfo?.supportsThinking ??
            ((isClaude && (m.id.includes("sonnet") || m.id.includes("opus"))) ||
            isReasoning),
          supportsVision:
            staticInfo?.supportsVision ?? (isClaude || isGpt || isGemini),
        };
      })
      .sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Get available models for a provider.
 * Tries live API first (with cache), falls back to static list.
 */
export async function getModelsForProvider(
  providerId: string,
  apiKey?: string | null
): Promise<ProviderModels> {
  const cacheKey = `${providerId}:${apiKey ? "live" : "static"}`;
  const cached = modelCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  // Try live fetching for supported providers
  if (apiKey) {
    let liveModels: ModelInfo[] = [];

    if (providerId === "gemini") {
      liveModels = await fetchGeminiModels(apiKey);
    } else if (providerId === "openai") {
      liveModels = await fetchOpenAIModels(apiKey);
    } else if (providerId === "anthropic") {
      liveModels = await fetchAnthropicModels(apiKey);
    } else if (providerId === "copilot") {
      liveModels = await fetchCopilotModels(apiKey);
    }

    if (liveModels.length > 0) {
      const result: ProviderModels = {
        providerId,
        models: liveModels,
        fromLiveApi: true,
        fetchedAt: Date.now(),
      };
      modelCache.set(cacheKey, result);
      return result;
    }
  }

  // Fall back to static models
  const staticModels = STATIC_MODELS[providerId] ?? [];
  const result: ProviderModels = {
    providerId,
    models: staticModels,
    fromLiveApi: false,
    fetchedAt: Date.now(),
  };

  modelCache.set(cacheKey, result);
  return result;
}

/**
 * Get all static models for all providers (no API calls).
 */
export function getAllStaticModels(): Record<string, ModelInfo[]> {
  return STATIC_MODELS;
}

/**
 * Invalidate cached models for a provider (e.g., after API key update).
 */
export function invalidateModelCache(providerId: string): void {
  for (const key of modelCache.keys()) {
    if (key.startsWith(`${providerId}:`)) {
      modelCache.delete(key);
    }
  }
}
