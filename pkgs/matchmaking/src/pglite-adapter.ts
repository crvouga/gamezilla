/**
 * PGlite → `@pkgs/sql-client` {@link SqlClient} adapter, intended
 * primarily for tests but exported as part of the public API for any
 * embedder that wants an in-process Postgres-compatible backend.
 *
 * PGlite speaks `$1` positional parameters natively, so the adapter
 * unpacks the {@link Sql} fragment's `.text` (`$1, $2, ...`) + `.values`
 * on every call. Its transaction callback receives a {@link Transaction}
 * handle whose `.query()` mirrors the top-level shape, so wrapping it in
 * another `SqlClient` is a straight delegation.
 */

import type { Sql, Value } from '@pkgs/sql';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client/interface';

type PgliteQueryResult<T> = {
  readonly rows: readonly T[];
  readonly affectedRows?: number;
};

type PgliteQueryable = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<PgliteQueryResult<T>>;
};

type PgliteLike = PgliteQueryable & {
  transaction<T>(fn: (tx: PgliteQueryable) => Promise<T>): Promise<T>;
};

function runResultFrom(result: PgliteQueryResult<unknown>): RunResult {
  return { changes: result.affectedRows ?? 0, lastInsertRowid: 0 };
}

function prepareFor(queryable: PgliteQueryable, query: Sql): PreparedStatement {
  const text = query.text;
  return {
    query: async <T = Record<string, unknown>>(params?: Value[]) => {
      const result = await queryable.query<T>(text, params ?? []);
      return [...result.rows];
    },
    run: async (params?: Value[]) => {
      const result = await queryable.query(text, params ?? []);
      return runResultFrom(result);
    },
  };
}

function wrap(queryable: PgliteQueryable): SqlClient {
  return {
    connect: async () => {
      /* PGlite lifecycle is owned by the caller */
    },
    disconnect: async () => {
      /* PGlite lifecycle is owned by the caller */
    },
    async query<T = Record<string, unknown>>(query: Sql): Promise<T[]> {
      const result = await queryable.query<T>(query.text, [...query.values]);
      return [...result.rows];
    },
    async run(query: Sql): Promise<RunResult> {
      const result = await queryable.query(query.text, [...query.values]);
      return runResultFrom(result);
    },
    prepare(query: Sql): PreparedStatement {
      return prepareFor(queryable, query);
    },
    transaction<T>(_fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      throw new Error(
        'Nested transactions are not supported by the matchmaking SqlClient'
      );
    },
  };
}

export function createPgliteSqlClient(db: PgliteLike): SqlClient {
  return {
    ...wrap(db),
    transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return db.transaction((tx) => fn(wrap(tx)));
    },
  };
}
