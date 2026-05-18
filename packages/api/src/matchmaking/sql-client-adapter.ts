/**
 * Adapts a per-request `pg.Client` (the connection the API checks out via
 * Hyperdrive for the lifetime of one HTTP request) into the matchmaking
 * package's {@link MmSqlClient} port.
 *
 * Unlike {@link createPgSqlClient} (which expects a `pg.Pool` and uses
 * `pool.connect()` to pin a single connection per transaction), this adapter
 * runs `BEGIN`/`COMMIT`/`ROLLBACK` directly on the supplied client because we
 * already own the connection exclusively for this request.
 */

import type {
  QueryResult,
  SqlClient as MmSqlClient,
} from '@gamezilla/matchmaking/sql-client';
import type { Client, QueryResultRow } from 'pg';

function txClient(client: Client): MmSqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const result = await client.query<QueryResultRow & T>(
        sql,
        params === undefined ? undefined : [...params]
      );
      return { rows: result.rows as T[] };
    },
    transaction<T>(_fn: (tx: MmSqlClient) => Promise<T>): Promise<T> {
      throw new Error('Nested transactions are not supported');
    },
  };
}

export function createMatchmakingSqlClientFromPgClient(
  client: Client
): MmSqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const result = await client.query<QueryResultRow & T>(
        sql,
        params === undefined ? undefined : [...params]
      );
      return { rows: result.rows as T[] };
    },
    async transaction<T>(fn: (tx: MmSqlClient) => Promise<T>): Promise<T> {
      await client.query('BEGIN');
      try {
        const result = await fn(txClient(client));
        await client.query('COMMIT');
        return result;
      } catch (err: unknown) {
        await client.query('ROLLBACK').catch(() => {
          /* swallow rollback errors so the original error propagates */
        });
        throw err;
      }
    },
  };
}
