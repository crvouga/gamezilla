/**
 * {@link PostgresSqlClient} backed by `@neondatabase/serverless` HTTP `/sql`.
 * Stateless per query; suitable for Cloudflare Workers without Hyperdrive.
 */
import { assert } from '@pkgs/assert';
import {
  neon,
  neonConfig,
  type NeonQueryFunction,
} from '@neondatabase/serverless';
import {
  isTransientNeonError,
  NEON_HTTP_MAX_QUERY_RETRIES,
  neonHttpBackoffDelayMs,
  neonHttpSleep,
} from './neon-http-retry';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from './interface';
import { quotePgIdent, type PostgresDbScope } from './postgres-schema';
import {
  assertPgSessionSchema,
  withPostgresSearchPathOption,
} from './postgres-session-schema';
import { questionMarkParamsToDollarParams } from './positional-params';

type QueuedQuery = {
  readonly sql: string;
  readonly params: unknown[];
};

/**
 * {@link SqlClient} over Neon's stateless HTTP driver. Pins every request to
 * {@link PostgresDbScope} by running `SET search_path` inside each Neon HTTP
 * transaction (startup `options` are not reliably forwarded over `/sql`).
 *
 * `transaction()` batches the callback's queued statements into one Neon HTTP
 * transaction. Queries inside the callback must not depend on prior row
 * results (DDL migrations and idempotent writes are fine).
 */
export class SqlClientImplNeonHttp implements PostgresSqlClient {
  private readonly sql: NeonQueryFunction<false, true>;
  private readonly sessionSchemaSql: string;

  constructor(
    connectionString: string,
    readonly dbScope: PostgresDbScope
  ) {
    neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
    const scopedUrl = withPostgresSearchPathOption(connectionString, dbScope);
    this.sql = neon(scopedUrl, { fullResults: true });
    this.sessionSchemaSql = `SET search_path TO ${quotePgIdent(dbScope.schema)}`;
  }

  async connect(): Promise<void> {
    await this.execWithRetry('SELECT 1', undefined);
    await assertPgSessionSchema(toPgQueryable(this), this.dbScope);
  }

  async disconnect(): Promise<void> {}

  private async execWithRetry(
    sql: string,
    params: unknown[] | undefined
  ): Promise<{ rows: unknown[]; rowCount: number | null }> {
    let attempt = 0;
    let lastError: unknown = null;
    while (attempt <= NEON_HTTP_MAX_QUERY_RETRIES) {
      try {
        const [, result] = await this.sql.transaction((txn) => [
          txn.query(this.sessionSchemaSql),
          params === undefined ? txn.query(sql) : txn.query(sql, params),
        ]);
        assert.ok(result !== undefined, 'Neon HTTP transaction missing query result');
        return {
          rows: result.rows,
          rowCount: result.rowCount,
        };
      } catch (err) {
        if (
          !isTransientNeonError(err) ||
          attempt === NEON_HTTP_MAX_QUERY_RETRIES
        ) {
          throw err;
        }
        lastError = err;
        await neonHttpSleep(neonHttpBackoffDelayMs(attempt));
        attempt += 1;
      }
    }
    throw lastError ?? new Error('execWithRetry: exhausted without resolution');
  }

  private async execTransactionWithRetry(
    queries: readonly QueuedQuery[]
  ): Promise<void> {
    let attempt = 0;
    let lastError: unknown = null;
    while (attempt <= NEON_HTTP_MAX_QUERY_RETRIES) {
      try {
        await this.sql.transaction((txn) => [
          txn.query(this.sessionSchemaSql),
          ...queries.map((q) => txn.query(q.sql, q.params)),
        ]);
        return;
      } catch (err) {
        if (
          !isTransientNeonError(err) ||
          attempt === NEON_HTTP_MAX_QUERY_RETRIES
        ) {
          throw err;
        }
        lastError = err;
        await neonHttpSleep(neonHttpBackoffDelayMs(attempt));
        attempt += 1;
      }
    }
    throw lastError ?? new Error('execTransactionWithRetry: exhausted');
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
      lastInsertRowid: readLastInsertRowid(
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
    const queued: QueuedQuery[] = [];
    const txClient = createQueuedTxClient(queued);
    const result = await fn(txClient);
    if (queued.length > 0) {
      await this.execTransactionWithRetry(queued);
    }
    return result;
  }
}

function createQueuedTxClient(queued: QueuedQuery[]): SqlClient {
  const queue = (sql: string, params?: unknown[]): void => {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    queued.push({ sql: pgSql, params: pgParams });
  };

  return {
    connect: async () => {},
    disconnect: async () => {},
    query: async <T = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ) => {
      queue(sql, params);
      return [] as T[];
    },
    run: async (sql: string, params?: unknown[]) => {
      queue(sql, params);
      return { changes: 0, lastInsertRowid: 0 };
    },
    prepare: (sql: string) => ({
      query: <T = Record<string, unknown>>(params?: unknown[]) => {
        queue(sql, params);
        return Promise.resolve([] as T[]);
      },
      run: (params?: unknown[]) => {
        queue(sql, params);
        return Promise.resolve({ changes: 0, lastInsertRowid: 0 });
      },
    }),
    transaction: () => {
      throw new Error('Nested transactions are not supported');
    },
  };
}

function toPgQueryable(sqlClient: SqlClient): {
  query<R extends Record<string, unknown>>(
    queryText: string
  ): Promise<{ rows: R[] }>;
} {
  return {
    query: async <R extends Record<string, unknown>>(queryText: string) => ({
      rows: await sqlClient.query<R>(queryText),
    }),
  };
}

function readLastInsertRowid(rows: Record<string, unknown>[]): number {
  const first = rows[0];
  if (first !== null && first !== undefined && 'id' in first) {
    const id = first['id'];
    if (typeof id === 'number') return id;
    if (typeof id === 'bigint') return Number(id);
    if (typeof id === 'string') return parseInt(id, 10) || 0;
  }
  return 0;
}
