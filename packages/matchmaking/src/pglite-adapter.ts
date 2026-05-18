/**
 * PGlite → {@link SqlClient} adapter, intended primarily for tests but
 * exported as part of the public API for any app that wants an in-process
 * Postgres-compatible backend.
 *
 * PGlite's transaction callback receives a {@link Transaction} handle whose
 * `.query()` mirrors the top-level shape, so wrapping it in another
 * `SqlClient` is a straight delegation.
 */

import type { QueryResult, SqlClient } from './sql-client';

type PgliteQueryResult<T> = { readonly rows: readonly T[] };

type PgliteTransaction = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<PgliteQueryResult<T>>;
};

type PgliteLike = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<PgliteQueryResult<T>>;
  transaction<T>(fn: (tx: PgliteTransaction) => Promise<T>): Promise<T>;
};

function wrap(tx: PgliteTransaction): SqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const result = await tx.query<T>(
        sql,
        params === undefined ? undefined : [...params]
      );
      return { rows: [...result.rows] };
    },
    transaction<T>(_fn: (inner: SqlClient) => Promise<T>): Promise<T> {
      throw new Error(
        'Nested transactions are not supported by the matchmaking SqlClient'
      );
    },
  };
}

export function createPgliteSqlClient(db: PgliteLike): SqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const result = await db.query<T>(
        sql,
        params === undefined ? undefined : [...params]
      );
      return { rows: [...result.rows] };
    },
    transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return db.transaction((tx) => fn(wrap(tx)));
    },
  };
}
