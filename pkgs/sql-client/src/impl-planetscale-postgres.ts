import {
  neon,
  neonConfig,
  type NeonQueryFunction,
} from '@neondatabase/serverless';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

/**
 * Codes / patterns we treat as transient transport failures from the Neon
 * HTTP path. These are typically caused by serverless gateway connection
 * resets under burst load or short network blips and are safe to retry
 * because the Neon HTTP `/sql` endpoint is request/response (no in-flight
 * transactional state to corrupt on retry of an idempotent query).
 */
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

function isTransientNeonError(error: unknown): boolean {
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

const MAX_QUERY_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 200;
const RETRY_MAX_DELAY_MS = 4000;

function backoffDelayMs(attempt: number): number {
  // Exponential backoff with full jitter.
  const exp = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * {@link SqlClient} adapter for Postgres via the Neon serverless driver's
 * stateless HTTP path. No WebSocket connections, no connection pool,
 * no stale connection timeouts in serverless environments.
 *
 * `transaction()` runs the callback's queries sequentially over HTTP without
 * database-level isolation. Safe when operations are idempotent (e.g.
 * INSERT ON CONFLICT DO NOTHING, full snapshot recomputes).
 *
 * Transient transport failures (`ECONNRESET`, gateway connection drops,
 * etc.) are retried with exponential backoff up to {@link MAX_QUERY_RETRIES}
 * times so long-running batch workloads (e.g. `seed:puzzles`) tolerate
 * brief serverless gateway hiccups without aborting.
 *
 * @see https://api-docs.planetscale.com/docs/postgres/connecting/neon-serverless-driver
 */
export class SqlClientImplPlanetScalePostgres implements SqlClient {
  private sql: NeonQueryFunction<false, true>;

  constructor(connectionString: string) {
    neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
    this.sql = neon(connectionString, { fullResults: true });
  }

  async connect(): Promise<void> {
    await this.execWithRetry('SELECT 1', undefined);
  }

  async disconnect(): Promise<void> {}

  private async execWithRetry(
    sql: string,
    params: unknown[] | undefined
  ): Promise<{ rows: unknown[]; rowCount: number | null }> {
    let attempt = 0;
    let lastError: unknown = null;
    while (attempt <= MAX_QUERY_RETRIES) {
      try {
        const result =
          params === undefined
            ? await this.sql.query(sql)
            : await this.sql.query(sql, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount,
        };
      } catch (err) {
        if (!isTransientNeonError(err) || attempt === MAX_QUERY_RETRIES) {
          throw err;
        }
        lastError = err;
        await sleep(backoffDelayMs(attempt));
        attempt += 1;
      }
    }
    // Unreachable — the loop either returns or throws — but keeps tsc happy.
    throw lastError ?? new Error('execWithRetry: exhausted without resolution');
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.execWithRetry(pgSql, pgParams);
    return result.rows as T[];
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.execWithRetry(pgSql, pgParams);
    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid: getLastInsertRowid(
        result.rows as Record<string, unknown>[]
      ),
    };
  }

  prepare(sql: string): PreparedStatement {
    return {
      query: <T = Record<string, unknown>>(params?: unknown[]) =>
        this.query<T>(sql, params),
      run: (params?: unknown[]) => this.run(sql, params),
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

function getLastInsertRowid(rows: Record<string, unknown>[]): number {
  const first = rows[0];
  if (first !== null && first !== undefined && 'id' in first) {
    const id = first['id'];
    if (typeof id === 'number') return id;
    if (typeof id === 'bigint') return Number(id);
    if (typeof id === 'string') return parseInt(id, 10) || 0;
  }
  return 0;
}
