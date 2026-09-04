/**
 * Schema-agnostic Postgres reachability probe (`SELECT 1`).
 *
 * Retries with backoff: managed hosts (e.g. Neon) often drop the first TCP
 * session while waking a suspended compute (`Connection terminated
 * unexpectedly`). Permanent auth/config failures fail fast.
 */
import type { Timers } from '@pkgs/clock';
import { Client } from 'pg';
import { sanitizePostgresUrlForNodePg } from './sanitize-url-for-node-pg';

const PING_ATTEMPTS = 5;
/** First attempt immediate; then back off for cold-start / pooler flaps. */
const PING_RETRY_DELAYS_MS = [0, 500, 1_000, 2_000, 4_000] as const;
const PING_CONNECT_TIMEOUT_MS = 10_000;

const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  '57P01',
  '57P02',
  '57P03',
  '53300',
]);

const TRANSIENT_MESSAGE_SNIPPETS = [
  'connection terminated',
  'connection reset',
  'econnreset',
  'econnrefused',
  'etimedout',
  'timeout expired',
  'server closed the connection',
  'connection refused',
  'too many clients',
  'remaining connection slots',
  'cannot connect now',
  'the database system is starting up',
  'ssl connection has been closed unexpectedly',
] as const;

const PERMANENT_MESSAGE_SNIPPETS = [
  'password authentication failed',
  'no pg_hba.conf entry',
] as const;

export async function pingPostgres(
  connectionString: string,
  timers: Timers
): Promise<void> {
  const sanitized = sanitizePostgresUrlForNodePg(connectionString);
  let lastError: unknown;
  for (let attempt = 0; attempt < PING_ATTEMPTS; attempt++) {
    const delayMs = PING_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delayMs > 0) await sleep(delayMs, timers);
    try {
      await pingPostgresOnce(sanitized);
      return;
    } catch (error) {
      lastError = error;
      if (!isTransientPingError(error) || attempt === PING_ATTEMPTS - 1) {
        break;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'Postgres ping failed'));
}

async function pingPostgresOnce(connectionString: string): Promise<void> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: PING_CONNECT_TIMEOUT_MS,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    try {
      await client.end();
    } catch {
      /* best-effort close on an unconnected/failed client */
    }
  }
}

function sleep(ms: number, timers: Timers): Promise<void> {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

function readErrorCode(error: Error): string {
  const code = (error as unknown as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function isPermanentConfigError(message: string): boolean {
  for (const snippet of PERMANENT_MESSAGE_SNIPPETS) {
    if (message.includes(snippet)) return true;
  }
  return (
    message.includes('does not exist') &&
    (message.includes('database') || message.includes('role'))
  );
}

function matchesTransientMessage(message: string): boolean {
  for (const snippet of TRANSIENT_MESSAGE_SNIPPETS) {
    if (message.includes(snippet)) return true;
  }
  return false;
}

/** Errors worth retrying on a reachability probe (not auth / config rejects). */
export function isTransientPingError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (TRANSIENT_ERROR_CODES.has(readErrorCode(error))) return true;
  const msg = error.message.toLowerCase();
  if (isPermanentConfigError(msg)) return false;
  return matchesTransientMessage(msg);
}
