/**
 * Provider Config Detail API
 *
 * PUT    /api/providers/[providerId] — Update a specific provider config
 * DELETE /api/providers/[providerId] — Remove a provider config
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import {
  upsertProviderConfig,
  deleteProviderConfig,
} from "@/lib/storage/provider-store";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { providerId } = await params;
  const body = await req.json();

  const config = await upsertProviderConfig(session.user.id, providerId, body);

  return NextResponse.json({
    id: config.id,
    providerId: config.providerId,
    enabled: config.enabled,
    defaultModel: config.defaultModel,
    hasApiKey: !!config.apiKey,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { providerId } = await params;
  const deleted = await deleteProviderConfig(session.user.id, providerId);

  if (!deleted) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
