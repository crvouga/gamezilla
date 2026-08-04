/**
 * PGlite → {@link SqlClient} adapter for hermetic Postgres-compatible tests.
 *
 * Duck-typed over anything with `.query` + `.transaction` (typically
 * `@electric-sql/pglite`). The caller owns PGlite lifecycle (`create` /
 * `close`); this adapter only bridges to `@pkgs/sql`.
 *
 * Uses `query.sql` (`?`) → `$n` like every other Postgres impl in this
 * package. Nested `transaction()` on a tx handle is rejected — PGlite has
 * no savepoint nesting through this surface.
 */

import type { Sql, Value } from '@pkgs/sql';
import type { PreparedStatement, RunResult, SqlClient } from '../interface';
import { questionMarkParamsToDollarParams } from '../positional-params';

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

async function execQuery<T>(
  queryable: PgliteQueryable,
  sqlText: string,
  params?: readonly unknown[]
): Promise<PgliteQueryResult<T>> {
  const [text, vals] = questionMarkParamsToDollarParams(sqlText, params);
  return queryable.query<T>(text, vals);
}

function prepareFor<T extends Record<string, unknown>>(
  queryable: PgliteQueryable,
  query: Sql<T>
): PreparedStatement<T> {
  const statementSql = query.sql;
  return {
    query: async (params?: Value[]) => {
      const result = await execQuery<T>(queryable, statementSql, params ?? []);
      return [...result.rows];
    },
    run: async (params?: Value[]) => {
      const result = await execQuery(queryable, statementSql, params ?? []);
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
    async query<T extends Record<string, unknown>>(
      query: Sql<T>
    ): Promise<T[]> {
      const result = await execQuery<T>(queryable, query.sql, query.values);
      return [...result.rows];
    },
    async run(query: Sql<unknown>): Promise<RunResult> {
      const result = await execQuery(queryable, query.sql, query.values);
      return runResultFrom(result);
    },
    prepare<T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> {
      return prepareFor(queryable, query);
    },
    transaction<T>(_fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      throw new Error(
        'Nested transactions are not supported by the PGlite SqlClient'
      );
    },
  };
}

/** Adapts a PGlite (or compatible) instance to {@link SqlClient}. */
export function createPgliteSqlClient(db: PgliteLike): SqlClient {
  return {
    ...wrap(db),
    transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return db.transaction((tx) => fn(wrap(tx)));
    },
  };
}
