/**
 * Provider Config API
 *
 * GET  /api/providers — List all provider configs for the current user
 * POST /api/providers — Create/update a provider config
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import {
  getProviderConfigs,
  upsertProviderConfig,
  resolveApiKey,
  getProviderConfig,
  PROVIDERS,
} from "@/lib/storage/provider-store";
import { getModelsForProvider } from "@/lib/models/model-registry";
import { getCopilotSessionToken } from "@/lib/copilot/token-manager";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await getProviderConfigs(session.user.id);

  // Build a response that includes provider definitions + user configs + live models
  const result = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const userConfig = configs.find((c) => c.providerId === provider.id);
      const hasEnvKey = !!provider.envKey && !!process.env[provider.envKey ?? ""];

      // For Copilot: resolve the session token from the stored GitHub OAuth token
      let apiKey: string | null = null;

      if (provider.id === "copilot") {
        // Get the GitHub access token from DB (stored as accessToken on the config)
        const copilotConfig = await getProviderConfig(session.user.id, "copilot");
        const githubToken = copilotConfig?.accessToken;
        if (githubToken) {
          try {
            apiKey = await getCopilotSessionToken(githubToken);
          } catch {
            // Token exchange failed — fall back to static models
            apiKey = null;
          }
        }
      } else {
        apiKey = await resolveApiKey(session.user.id, provider.id);
      }

      const { models, fromLiveApi } = await getModelsForProvider(provider.id, apiKey);

      const defaultModel = userConfig?.defaultModel ?? models[0]?.id ?? null;

      return {
        ...provider,
        models,
        fromLiveApi,
        configured: !!userConfig?.apiKey || !!userConfig?.accessToken || hasEnvKey,
        enabled: userConfig?.enabled ?? false,
        defaultModel,
        hasEnvKey,
        // Don't send actual keys to the client
        hasApiKey: !!userConfig?.apiKey,
        hasOAuthToken: !!userConfig?.accessToken,
      };
    })
  );

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { providerId, apiKey, defaultModel, enabled, settings } = body;

  if (!providerId) {
    return NextResponse.json({ error: "providerId is required" }, { status: 400 });
  }

  const providerDef = PROVIDERS.find((p) => p.id === providerId);
  if (!providerDef) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const config = await upsertProviderConfig(session.user.id, providerId, {
    apiKey,
    defaultModel,
    enabled,
    settings,
  });

  return NextResponse.json({
    id: config.id,
    providerId: config.providerId,
    enabled: config.enabled,
    defaultModel: config.defaultModel,
    hasApiKey: !!config.apiKey,
  });
}
