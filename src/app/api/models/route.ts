/**
 * Models API
 *
 * GET /api/models?provider=<providerId>
 *   Returns available models for the given provider.
 *   Uses live API if the user has an API key configured; falls back to static list.
 *
 * GET /api/models
 *   Returns all static models for all providers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import { getModelsForProvider, getAllStaticModels } from "@/lib/models/model-registry";
import { resolveApiKey, PROVIDERS } from "@/lib/storage/provider-store";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("provider");

  // Return all static models if no provider specified
  if (!providerId) {
    return NextResponse.json({ models: getAllStaticModels(), fromLiveApi: false });
  }

  // Validate provider
  const providerDef = PROVIDERS.find((p) => p.id === providerId);
  if (!providerDef) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
  }

  // Try to get the user's API key to enable live model fetching
  const apiKey = await resolveApiKey(session.user.id, providerId);

  const result = await getModelsForProvider(providerId, apiKey);

  return NextResponse.json(result);
}
