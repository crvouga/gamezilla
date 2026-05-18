/**
 * `pg.Pool` → {@link SqlClient} adapter. Plain queries dispatch through the
 * pool; transactional work pins a single `PoolClient` so `FOR UPDATE` locks
 * outlive the implicit auto-checkin.
 */

import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { QueryResult, SqlClient } from './sql-client';

type Queryable = Pick<Pool | PoolClient, 'query'>;

function wrapResult<T>(rows: T[]): QueryResult<T> {
  return { rows };
}

function clientFor(queryable: Queryable): SqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const result = await queryable.query<QueryResultRow & T>(
        sql,
        params === undefined ? undefined : [...params]
      );
      return wrapResult<T>(result.rows as T[]);
    },
    transaction<T>(_fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      throw new Error(
        'Nested transactions are not supported by the matchmaking SqlClient'
      );
    },
  };
}

async function runTx<T>(
  poolClient: PoolClient,
  fn: (tx: SqlClient) => Promise<T>
): Promise<T> {
  await poolClient.query('BEGIN');
  try {
    const result = await fn(clientFor(poolClient));
    await poolClient.query('COMMIT');
    return result;
  } catch (err: unknown) {
    await poolClient.query('ROLLBACK').catch(() => {
      /* swallow rollback errors so the original error propagates */
    });
    throw err;
  }
}

export function createPgSqlClient(pool: Pool): SqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const result = await pool.query<QueryResultRow & T>(
        sql,
        params === undefined ? undefined : [...params]
      );
      return wrapResult<T>(result.rows as T[]);
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const poolClient = await pool.connect();
      try {
        return await runTx(poolClient, fn);
      } finally {
        poolClient.release();
      }
    },
  };
}
