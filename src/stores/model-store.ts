/**
 * Model Store
 *
 * Manages the currently selected AI provider and model for chat.
 * Fetches available providers + models from /api/providers and exposes
 * a selectedProviderId + selectedModelId that useAgent reads before
 * sending requests to /api/agent.
 */

import { create } from "zustand";

// ─── Types ──────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  featured?: boolean;
  contextWindow?: number;
  supportsThinking?: boolean;
  supportsVision?: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  models: ModelInfo[];
  fromLiveApi: boolean;
  configured: boolean;
  enabled: boolean;
  defaultModel: string | null;
  hasEnvKey: boolean;
  hasApiKey: boolean;
  hasOAuthToken: boolean;
  authType: "api_key" | "oauth" | "env";
}

export interface ModelStore {
  /** All providers from the server */
  providers: ProviderInfo[];
  /** Currently selected provider ID */
  selectedProviderId: string | null;
  /** Currently selected model ID */
  selectedModelId: string | null;
  /** Whether the provider list is loading */
  isLoading: boolean;
  /** Last fetch error */
  error: string | null;
  /** Timestamp of last successful fetch */
  fetchedAt: number | null;

  // Actions
  fetchProviders: () => Promise<void>;
  setProvider: (providerId: string) => void;
  setModel: (modelId: string) => void;
  setProviderAndModel: (providerId: string, modelId: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────

export const useModelStore = create<ModelStore>((set, get) => ({
  providers: [],
  selectedProviderId: null,
  selectedModelId: null,
  isLoading: false,
  error: null,
  fetchedAt: null,

  fetchProviders: async () => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch("/api/providers");
      if (!res.ok) {
        throw new Error(`Failed to fetch providers: ${res.status}`);
      }

      const data = (await res.json()) as ProviderInfo[];
      const providers = data ?? [];

      // Only keep configured providers (have API key, OAuth token, or env key)
      const configuredProviders = providers.filter(
        (p) => p.configured
      );

      const state = get();

      // If no provider is selected yet, auto-select the first configured + enabled one
      let selectedProviderId = state.selectedProviderId;
      let selectedModelId = state.selectedModelId;

      if (!selectedProviderId || !configuredProviders.find((p) => p.id === selectedProviderId)) {
        const firstEnabled = configuredProviders.find((p) => p.enabled) ?? configuredProviders[0];
        if (firstEnabled) {
          selectedProviderId = firstEnabled.id;
          selectedModelId =
            firstEnabled.defaultModel ??
            firstEnabled.models[0]?.id ??
            null;
        }
      } else if (selectedProviderId && !selectedModelId) {
        // Provider selected but no model — pick default
        const provider = configuredProviders.find((p) => p.id === selectedProviderId);
        if (provider) {
          selectedModelId =
            provider.defaultModel ??
            provider.models[0]?.id ??
            null;
        }
      }

      set({
        providers,
        selectedProviderId,
        selectedModelId,
        isLoading: false,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  setProvider: (providerId: string) => {
    const { providers } = get();
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    set({
      selectedProviderId: providerId,
      selectedModelId:
        provider.defaultModel ??
        provider.models[0]?.id ??
        null,
    });
  },

  setModel: (modelId: string) => {
    set({ selectedModelId: modelId });
  },

  setProviderAndModel: (providerId: string, modelId: string) => {
    set({ selectedProviderId: providerId, selectedModelId: modelId });
  },
}));
