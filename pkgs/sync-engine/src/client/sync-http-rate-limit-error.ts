/** HTTP 429 with Retry-After semantics for upload backoff. */
export class SyncHttpRateLimitError extends Error {
  override readonly name = 'SyncHttpRateLimitError';
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`rate_limited:${retryAfterMs}`);
    this.retryAfterMs = Math.max(0, retryAfterMs);
  }
}

export function parseRateLimitRetryMs(error: unknown): number | null {
  if (error instanceof SyncHttpRateLimitError) return error.retryAfterMs;
  if (error instanceof Error) {
    const m = /^rate_limited:(\d+)$/.exec(error.message);
    if (m !== null) return Number(m[1]);
  }
  return null;
}
