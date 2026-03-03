/**
 * GitHub Copilot Token Manager
 *
 * Handles the two-stage token flow:
 * 1. GitHub OAuth token (long-lived, from device flow)
 * 2. Copilot session token (short-lived, ~30 min, exchanged from GitHub token)
 *
 * The Copilot API at api.githubcopilot.com requires a short-lived session
 * token obtained from the copilot_internal endpoint. This module manages
 * exchange, caching, and auto-refresh of those tokens.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface CopilotSessionToken {
  /** The short-lived token for api.githubcopilot.com */
  token: string;
  /** Unix timestamp (seconds) when this token expires */
  expiresAt: number;
}

export interface DeviceCodeResponse {
  /** The code the user enters at github.com/login/device */
  user_code: string;
  /** The URL the user visits */
  verification_uri: string;
  /** Device code to poll with */
  device_code: string;
  /** Polling interval in seconds */
  interval: number;
  /** Code expiry in seconds */
  expires_in: number;
}

export interface DevicePollResult {
  /** Set when auth is complete */
  access_token?: string;
  token_type?: string;
  scope?: string;
  /** Set when still waiting */
  error?: string;
  error_description?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

/** GitHub CLI's public OAuth client ID — used by many third-party tools */
const GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL =
  "https://api.github.com/copilot_internal/v2/token";

/** Refresh 2 minutes before actual expiry to avoid race conditions */
const REFRESH_BUFFER_SECONDS = 120;

// ─── In-Memory Cache ────────────────────────────────────────────────

/**
 * Cache of Copilot session tokens keyed by GitHub access token hash.
 * In a production setup this would be in Redis / DB, but for a
 * single-server Next.js app, in-memory is fine.
 */
const sessionTokenCache = new Map<string, CopilotSessionToken>();

/** Simple hash for cache key (not crypto, just for keying) */
function hashKey(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) - h + token.charCodeAt(i)) | 0;
  }
  return `gh_${h.toString(36)}`;
}

// ─── Device Flow ────────────────────────────────────────────────────

/**
 * Step 1: Initiate the GitHub device code flow.
 * Returns a user_code + verification_uri for the user to enter.
 */
export async function initiateDeviceFlow(): Promise<DeviceCodeResponse> {
  const res = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: "read:user",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub device code request failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<DeviceCodeResponse>;
}

/**
 * Step 2: Poll GitHub for the access token.
 * Call this on the server at the interval from Step 1.
 * Returns the access_token when the user has authorized, or an error string.
 */
export async function pollDeviceToken(
  deviceCode: string
): Promise<DevicePollResult> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub token poll failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<DevicePollResult>;
}

// ─── Copilot Session Token Exchange ─────────────────────────────────

/**
 * Exchange a long-lived GitHub access token for a short-lived Copilot
 * session token. The session token is cached and auto-refreshed.
 */
export async function getCopilotSessionToken(
  githubAccessToken: string
): Promise<string> {
  const cacheKey = hashKey(githubAccessToken);
  const cached = sessionTokenCache.get(cacheKey);

  if (cached && cached.expiresAt - REFRESH_BUFFER_SECONDS > Date.now() / 1000) {
    return cached.token;
  }

  // Exchange with Copilot internal API
  const res = await fetch(COPILOT_TOKEN_URL, {
    headers: {
      Authorization: `token ${githubAccessToken}`,
      Accept: "application/json",
      "User-Agent": "ReelForge/1.0",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      // Token revoked or expired — clear cache
      sessionTokenCache.delete(cacheKey);
      throw new Error(
        "GitHub token is invalid or expired. Please reconnect GitHub Copilot."
      );
    }
    throw new Error(
      `Copilot token exchange failed: ${res.status} ${text}`
    );
  }

  const data = (await res.json()) as {
    token: string;
    expires_at: number;
    [key: string]: unknown;
  };

  const sessionToken: CopilotSessionToken = {
    token: data.token,
    expiresAt: data.expires_at,
  };

  sessionTokenCache.set(cacheKey, sessionToken);
  return sessionToken.token;
}

/**
 * Validate a GitHub access token by checking the user endpoint.
 * Returns the GitHub username if valid, null if not.
 */
export async function validateGitHubToken(
  accessToken: string
): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "ReelForge/1.0",
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { login?: string };
    return data.login ?? null;
  } catch {
    return null;
  }
}

/**
 * Clear cached Copilot session token for a GitHub token.
 */
export function clearSessionTokenCache(githubAccessToken: string): void {
  const cacheKey = hashKey(githubAccessToken);
  sessionTokenCache.delete(cacheKey);
}
