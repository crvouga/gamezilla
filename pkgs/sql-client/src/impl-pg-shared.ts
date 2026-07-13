/**
 * Shared helpers for `node-postgres` ({@link Pool} / {@link Client}) backed
 * {@link SqlClient} implementations.
 */
import type { Pool, PoolClient, QueryResult } from 'pg';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import type { PostgresDbScope } from './postgres-schema';
import { quotePgIdent } from './postgres-schema';
import { questionMarkParamsToDollarParams } from './positional-params';

export function readLastInsertRowid(
  rows: readonly Record<string, unknown>[] | undefined | null
): number {
  const first = rows?.[0];
  if (first !== undefined && first !== null && 'id' in first) {
    const id = first['id'];
    if (typeof id === 'number') return id;
    if (typeof id === 'bigint') return Number(id);
    if (typeof id === 'string') return parseInt(id, 10) || 0;
  }
  return 0;
}

/** node-pg may omit `rows` on multi-statement simple queries (e.g. SET + DDL). */
export function pgQueryRows<T = Record<string, unknown>>(
  res: QueryResult
): T[] {
  return (res.rows ?? []) as T[];
}

export function pgRunResultFromQuery(res: QueryResult): RunResult {
  return {
    changes: res.rowCount ?? 0,
    lastInsertRowid: readLastInsertRowid(res.rows),
  };
}

/** `PoolClient` or `Client` — anything that can run parameterized queries. */
export type PgExecutor = Pick<PoolClient, 'query'>;

export type PgSearchPathPinQueryArgs = {
  queryable: PgExecutor;
  dbScope: PostgresDbScope;
  pinSearchPathEachQuery: boolean;
  sql: string;
  params?: unknown[] | undefined;
};

/**
 * Runs SQL on pooler connections with the correct `search_path` pin strategy.
 * Parameterized statements cannot bundle `SET search_path` (Postgres rejects
 * multi-command prepared statements); those get a separate pin query first.
 * For {@link Pool} callers, pin + query share one checked-out client so Neon
 * transaction poolers do not split SET and the follow-up across backends.
 */
function isPgPool(queryable: PgExecutor): queryable is Pool {
  const candidate = queryable as Pool;
  return (
    typeof candidate.connect === 'function' &&
    typeof candidate.totalCount === 'number'
  );
}

/**
 * Runs one statement on Neon/PgBouncer transaction poolers where session GUCs
 * do not survive separate round trips. Wraps SET LOCAL in BEGIN/COMMIT so the
 * pin and the statement share one backend and node-pg returns query rows.
 */
async function pgQueryOnPinnedSession(
  executor: PgExecutor,
  dbScope: PostgresDbScope,
  text: string,
  vals: readonly unknown[]
): Promise<QueryResult> {
  await executor.query('BEGIN');
  try {
    await executor.query(
      `SET LOCAL search_path TO ${quotePgIdent(dbScope.schema)}`
    );
    const result =
      vals.length > 0
        ? await executor.query(text, [...vals])
        : await executor.query(text);
    await executor.query('COMMIT');
    return result;
  } catch (error: unknown) {
    try {
      await executor.query('ROLLBACK');
    } catch (rollbackError: unknown) {
      throw new AggregateError(
        [error, rollbackError],
        'Postgres query failed and transaction rollback also failed'
      );
    }
    throw error;
  }
}

export async function pgQueryWithOptionalSearchPathPin(
  args: PgSearchPathPinQueryArgs
): Promise<QueryResult> {
  const { queryable, dbScope, pinSearchPathEachQuery, sql, params } = args;
  const [text, vals] = questionMarkParamsToDollarParams(sql, params);
  if (!pinSearchPathEachQuery) {
    if (vals.length > 0) {
      return queryable.query(text, vals);
    }
    return queryable.query(text);
  }
  if (isPgPool(queryable)) {
    const client = await queryable.connect();
    try {
      return await pgQueryOnPinnedSession(client, dbScope, text, vals);
    } finally {
      client.release();
    }
  }
  return pgQueryOnPinnedSession(queryable, dbScope, text, vals);
}

export type PgRawSearchPathPinQueryArgs = {
  queryable: PgExecutor;
  /** Native `query` — bypasses pool pin wrappers on the wire round-trip. */
  execQuery: PgExecutor['query'];
  dbScope: PostgresDbScope;
  pinSearchPathEachQuery: boolean;
  text: string;
  values?: unknown[] | undefined;
};

/**
 * Like {@link pgQueryWithOptionalSearchPathPin} for callers that already use
 * native `$1` placeholders (Kysely / raw `pg` pool queries).
 */
export async function pgRawQueryWithSearchPathPin(
  args: PgRawSearchPathPinQueryArgs
): Promise<QueryResult> {
  const { execQuery, dbScope, pinSearchPathEachQuery, text, values } = args;
  if (!pinSearchPathEachQuery) {
    if (values !== undefined && values.length > 0) {
      return execQuery(text, values);
    }
    return execQuery(text);
  }
  return pgQueryOnPinnedSession(
    { query: execQuery },
    dbScope,
    text,
    values ?? []
  );
}

function pinPgExecutorQuery(
  executor: PgExecutor,
  dbScope: PostgresDbScope
): PgExecutor['query'] {
  const execQuery = executor.query.bind(executor);
  return ((...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string') {
      const values = args[1];
      return pgRawQueryWithSearchPathPin({
        queryable: executor,
        execQuery,
        dbScope,
        pinSearchPathEachQuery: true,
        text: first,
        ...(Array.isArray(values) ? { values } : {}),
      });
    }
    if (first !== null && typeof first === 'object' && 'text' in first) {
      const config = first as { text: string; values?: unknown[] };
      return pgRawQueryWithSearchPathPin({
        queryable: executor,
        execQuery,
        dbScope,
        pinSearchPathEachQuery: true,
        text: config.text,
        ...(config.values !== undefined ? { values: config.values } : {}),
      });
    }
    return execQuery(...(args as Parameters<PgExecutor['query']>));
  }) as PgExecutor['query'];
}

/**
 * Wraps checked-out `PoolClient`s so every query pins `search_path` on
 * Neon/PgBouncer pooler URLs. Kysely and legacy auth talk to the pool
 * directly and bypass {@link SqlClientImplPg}'s per-query pin.
 *
 * Only {@link Pool.connect} is patched — never {@link Pool.query}. Wrapping
 * `pool.query` deadlocks on `max: 1` pools because the pin path calls the
 * native `pool.query` while the outer wrapped call still holds the slot.
 */
export function wrapPgPoolWithSearchPathPin(
  pool: Pool,
  dbScope: PostgresDbScope
): Pool {
  const baseConnect = pool.connect.bind(pool);
  const wrapClient = (client: PoolClient): PoolClient => {
    client.query = pinPgExecutorQuery(client, dbScope) as typeof client.query;
    return client;
  };
  pool.connect = ((...args: unknown[]) => {
    if (typeof args[0] === 'function') {
      const cb = args[0] as (
        err: Error | undefined,
        client: PoolClient | undefined,
        done: (release?: boolean | (() => void)) => void
      ) => void;
      return baseConnect((err, client, done) => {
        if (client !== undefined) wrapClient(client);
        cb(err, client, done);
      });
    }
    return Promise.resolve(baseConnect()).then(wrapClient);
  }) as typeof pool.connect;
  return pool;
}

export function createPgSessionClient(poolClient: PgExecutor): SqlClient {
  const self: SqlClient = {
    connect: async () => {
      /* connection owned by pool */
    },
    disconnect: async () => {
      /* caller releases poolClient */
    },
    query: async <T = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ): Promise<T[]> => {
      const [text, vals] = questionMarkParamsToDollarParams(sql, params);
      const res = await poolClient.query(text, vals);
      return res.rows as T[];
    },
    run: async (sql: string, params?: unknown[]): Promise<RunResult> => {
      const [text, vals] = questionMarkParamsToDollarParams(sql, params);
      const res = await poolClient.query(text, vals);
      return pgRunResultFromQuery(res);
    },
    prepare: (sql: string): PreparedStatement => ({
      query: <T = Record<string, unknown>>(params?: unknown[]) =>
        self.query<T>(sql, params),
      run: (params?: unknown[]) => self.run(sql, params),
    }),
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> => {
      return fn(self);
    },
  };
  return self;
}
