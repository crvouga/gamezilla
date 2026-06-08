const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
]);

const TRANSIENT_MESSAGE_PATTERNS: readonly RegExp[] = [
  /socket connection was closed unexpectedly/i,
  /fetch failed/i,
  /network connection was lost/i,
  /terminating connection/i,
  /connection terminated unexpectedly/i,
  /server is not currently accepting connections/i,
];

export function isTransientNeonError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const e = error as {
    code?: unknown;
    cause?: unknown;
    message?: unknown;
  };
  if (typeof e.code === 'string' && TRANSIENT_ERROR_CODES.has(e.code)) {
    return true;
  }
  if (e.cause !== undefined && isTransientNeonError(e.cause)) return true;
  if (typeof e.message === 'string') {
    for (const re of TRANSIENT_MESSAGE_PATTERNS) {
      if (re.test(e.message)) return true;
    }
  }
  return false;
}

export const NEON_HTTP_MAX_QUERY_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 200;
const RETRY_MAX_DELAY_MS = 4000;

export function neonHttpBackoffDelayMs(attempt: number): number {
  const exp = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

export function neonHttpSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
