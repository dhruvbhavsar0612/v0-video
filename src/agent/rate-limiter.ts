/**
 * Adaptive Rate Limiter
 *
 * Tracks Anthropic API rate limit state from response headers
 * and adaptively throttles requests to avoid 429 errors.
 *
 * Features:
 * - Reads x-ratelimit-* headers after each API call
 * - Waits when remaining capacity is low
 * - Retries with exponential backoff on 429 errors
 * - Rough token estimation before calls (char count / 4)
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface RateLimitState {
  requests: {
    limit: number;
    remaining: number;
    resetAt: Date | null;
  };
  tokens: {
    limit: number;
    remaining: number;
    resetAt: Date | null;
  };
}

export interface RateLimitEvent {
  type: "rate_limit";
  waitMs: number;
  remaining: {
    requests: number;
    tokens: number;
  };
  reason: string;
}

// ─── Rate Limiter ───────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

/** Low-water marks: throttle when remaining drops below these */
const REQUEST_LOW_WATER = 5;
const TOKEN_LOW_WATER = 2000;

export class RateLimiter {
  private state: RateLimitState = {
    requests: { limit: 0, remaining: Infinity, resetAt: null },
    tokens: { limit: 0, remaining: Infinity, resetAt: null },
  };

  /**
   * Estimate token count for a message payload.
   * Rough heuristic: ~4 characters per token.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if we need to wait before making a request.
   * Returns a RateLimitEvent if throttling is needed, null otherwise.
   */
  checkBeforeRequest(estimatedTokens: number): RateLimitEvent | null {
    const now = new Date();

    // Check request limit
    if (this.state.requests.remaining <= REQUEST_LOW_WATER && this.state.requests.resetAt) {
      const waitMs = Math.max(0, this.state.requests.resetAt.getTime() - now.getTime());
      if (waitMs > 0) {
        return {
          type: "rate_limit",
          waitMs,
          remaining: {
            requests: this.state.requests.remaining,
            tokens: this.state.tokens.remaining,
          },
          reason: `Request limit low (${this.state.requests.remaining}/${this.state.requests.limit} remaining). Waiting ${Math.ceil(waitMs / 1000)}s for reset.`,
        };
      }
    }

    // Check token limit
    if (
      this.state.tokens.remaining <= Math.max(TOKEN_LOW_WATER, estimatedTokens) &&
      this.state.tokens.resetAt
    ) {
      const waitMs = Math.max(0, this.state.tokens.resetAt.getTime() - now.getTime());
      if (waitMs > 0) {
        return {
          type: "rate_limit",
          waitMs,
          remaining: {
            requests: this.state.requests.remaining,
            tokens: this.state.tokens.remaining,
          },
          reason: `Token limit low (${this.state.tokens.remaining}/${this.state.tokens.limit} remaining, need ~${estimatedTokens}). Waiting ${Math.ceil(waitMs / 1000)}s for reset.`,
        };
      }
    }

    return null;
  }

  /**
   * Wait for the specified duration.
   */
  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update rate limit state from Anthropic API response headers.
   */
  updateFromHeaders(headers: Headers): void {
    const requestLimit = headers.get("x-ratelimit-limit-requests");
    const requestRemaining = headers.get("x-ratelimit-remaining-requests");
    const requestReset = headers.get("x-ratelimit-reset-requests");

    const tokenLimit = headers.get("x-ratelimit-limit-tokens");
    const tokenRemaining = headers.get("x-ratelimit-remaining-tokens");
    const tokenReset = headers.get("x-ratelimit-reset-tokens");

    if (requestLimit) this.state.requests.limit = parseInt(requestLimit, 10);
    if (requestRemaining) this.state.requests.remaining = parseInt(requestRemaining, 10);
    if (requestReset) this.state.requests.resetAt = parseResetTime(requestReset);

    if (tokenLimit) this.state.tokens.limit = parseInt(tokenLimit, 10);
    if (tokenRemaining) this.state.tokens.remaining = parseInt(tokenRemaining, 10);
    if (tokenReset) this.state.tokens.resetAt = parseResetTime(tokenReset);
  }

  /**
   * Calculate exponential backoff delay for a retry attempt.
   */
  getBackoffMs(attempt: number, retryAfterHeader?: string | null): number {
    if (retryAfterHeader) {
      const seconds = parseFloat(retryAfterHeader);
      if (!isNaN(seconds)) return seconds * 1000;
    }
    // Exponential backoff: 1s, 2s, 4s
    return BASE_BACKOFF_MS * Math.pow(2, attempt);
  }

  /**
   * Get the maximum number of retries allowed.
   */
  get maxRetries(): number {
    return MAX_RETRIES;
  }

  /**
   * Get current rate limit state (for diagnostics).
   */
  getState(): RateLimitState {
    return { ...this.state };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Parse the reset time from Anthropic headers.
 * The header value can be an ISO 8601 timestamp or a duration string like "1s", "500ms".
 */
function parseResetTime(value: string): Date {
  // Try ISO 8601 first
  const isoDate = new Date(value);
  if (!isNaN(isoDate.getTime())) return isoDate;

  // Try duration format (e.g., "1s", "500ms", "2m")
  const now = Date.now();
  const match = value.match(/^(\d+(?:\.\d+)?)(ms|s|m)$/);
  if (match) {
    const amount = parseFloat(match[1]);
    const unit = match[2];
    switch (unit) {
      case "ms":
        return new Date(now + amount);
      case "s":
        return new Date(now + amount * 1000);
      case "m":
        return new Date(now + amount * 60_000);
    }
  }

  // Fallback: 1 second from now
  return new Date(now + 1000);
}
