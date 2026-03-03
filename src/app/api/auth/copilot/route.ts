/**
 * GitHub Copilot Device Flow API
 *
 * POST /api/auth/copilot  { action: "initiate" }
 *   → Starts the device code flow, returns user_code + verification_uri
 *
 * POST /api/auth/copilot  { action: "poll", deviceCode: string }
 *   → Polls GitHub for the access token. Returns:
 *     - { status: "pending" } if the user hasn't authorized yet
 *     - { status: "complete", username: string } when authorized
 *     - { status: "expired" } if the code expired
 *     - { status: "error", error: string } on failure
 *
 * POST /api/auth/copilot  { action: "disconnect" }
 *   → Removes the stored Copilot OAuth token
 *
 * POST /api/auth/copilot  { action: "status" }
 *   → Returns current connection status
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import {
  initiateDeviceFlow,
  pollDeviceToken,
  validateGitHubToken,
  clearSessionTokenCache,
} from "@/lib/copilot/token-manager";
import {
  upsertProviderConfig,
  getProviderConfig,
} from "@/lib/storage/provider-store";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { action } = body as { action: string };

  switch (action) {
    // ─── Initiate Device Flow ─────────────────────────────────────
    case "initiate": {
      try {
        const deviceCode = await initiateDeviceFlow();
        return NextResponse.json({
          status: "initiated",
          userCode: deviceCode.user_code,
          verificationUri: deviceCode.verification_uri,
          deviceCode: deviceCode.device_code,
          interval: deviceCode.interval,
          expiresIn: deviceCode.expires_in,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
          { status: "error", error: msg },
          { status: 500 }
        );
      }
    }

    // ─── Poll for Token ───────────────────────────────────────────
    case "poll": {
      const { deviceCode } = body as { deviceCode: string };
      if (!deviceCode) {
        return NextResponse.json(
          { status: "error", error: "deviceCode is required" },
          { status: 400 }
        );
      }

      try {
        const result = await pollDeviceToken(deviceCode);

        if (result.access_token) {
          // Success — validate and store the token
          const username = await validateGitHubToken(result.access_token);
          if (!username) {
            return NextResponse.json(
              { status: "error", error: "Token validation failed" },
              { status: 500 }
            );
          }

          // Store the GitHub access token in the provider config
          await upsertProviderConfig(userId, "copilot", {
            accessToken: result.access_token,
            enabled: true,
            displayName: `GitHub Copilot (${username})`,
          });

          return NextResponse.json({
            status: "complete",
            username,
          });
        }

        // Still waiting or error
        if (
          result.error === "authorization_pending" ||
          result.error === "slow_down"
        ) {
          return NextResponse.json({ status: "pending" });
        }

        if (result.error === "expired_token") {
          return NextResponse.json({ status: "expired" });
        }

        // access_denied or other
        return NextResponse.json({
          status: "error",
          error: result.error_description ?? result.error ?? "Unknown error",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
          { status: "error", error: msg },
          { status: 500 }
        );
      }
    }

    // ─── Disconnect ───────────────────────────────────────────────
    case "disconnect": {
      try {
        const config = await getProviderConfig(userId, "copilot");
        if (config?.accessToken) {
          clearSessionTokenCache(config.accessToken);
        }

        await upsertProviderConfig(userId, "copilot", {
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          enabled: false,
          displayName: null,
        });

        return NextResponse.json({ status: "disconnected" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
          { status: "error", error: msg },
          { status: 500 }
        );
      }
    }

    // ─── Status Check ─────────────────────────────────────────────
    case "status": {
      try {
        const config = await getProviderConfig(userId, "copilot");
        if (!config?.accessToken) {
          return NextResponse.json({
            status: "disconnected",
            connected: false,
          });
        }

        // Validate the stored token
        const username = await validateGitHubToken(config.accessToken);
        if (!username) {
          // Token is stale — clear it
          await upsertProviderConfig(userId, "copilot", {
            accessToken: null,
            enabled: false,
          });
          return NextResponse.json({
            status: "disconnected",
            connected: false,
            reason: "token_expired",
          });
        }

        return NextResponse.json({
          status: "connected",
          connected: true,
          username,
          displayName: config.displayName,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
          { status: "error", error: msg },
          { status: 500 }
        );
      }
    }

    default:
      return NextResponse.json(
        { status: "error", error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}
