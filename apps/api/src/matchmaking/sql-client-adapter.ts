/**
 * Adapts a per-request Neon WebSocket `Client` (the connection the API opens
 * for the lifetime of one HTTP request) into the matchmaking package's
 * {@link MmSqlClient} port.
 *
 * Runs `BEGIN`/`COMMIT`/`ROLLBACK` directly on the supplied client because we
 * already own the connection exclusively for this request.
 */

import type {
  NeonQueryResultRow,
  NeonWsClient,
} from '@pkgs/sql-client/neon-types';
import type {
  SqlClient as MmSqlClient,
  QueryResult,
} from '@pkgs/matchmaking/storage';

function txClient(client: NeonWsClient): MmSqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const result = await client.query<NeonQueryResultRow & T>(
        sql,
        params === undefined ? undefined : [...params]
      );
      return { rows: result.rows as T[] };
    },
    tx<T>(_fn: (tx: MmSqlClient) => Promise<T>): Promise<T> {
      throw new Error('Nested transactions are not supported');
    },
  };
}

export function createMatchmakingSqlClientFromNeonClient(
  client: NeonWsClient
): MmSqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const result = await client.query<NeonQueryResultRow & T>(
        sql,
        params === undefined ? undefined : [...params]
      );
      return { rows: result.rows as T[] };
    },
    async tx<T>(fn: (tx: MmSqlClient) => Promise<T>): Promise<T> {
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
