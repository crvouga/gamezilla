/**
 * Adapts a per-request {@link SqlClient} into the matchmaking package's
 * {@link MmSqlClient} port.
 */

import type { SqlClient } from '@pkgs/sql-client/interface';
import type {
  SqlClient as MmSqlClient,
  QueryResult,
} from '@pkgs/matchmaking/storage';

function wrapQuery<T>(
  sqlClient: SqlClient,
  sql: string,
  params?: readonly unknown[]
): Promise<QueryResult<T>> {
  return sqlClient
    .query<T>(sql, params === undefined ? undefined : [...params])
    .then((rows) => ({ rows }));
}

function txClient(sqlClient: SqlClient): MmSqlClient {
  return {
    query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      return wrapQuery<T>(sqlClient, sql, params);
    },
    tx<T>(_fn: (tx: MmSqlClient) => Promise<T>): Promise<T> {
      throw new Error('Nested transactions are not supported');
    },
  };
}

export function createMatchmakingSqlClientFromSqlClient(
  sqlClient: SqlClient
): MmSqlClient {
  return {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      return wrapQuery<T>(sqlClient, sql, params);
    },
    async tx<T>(fn: (tx: MmSqlClient) => Promise<T>): Promise<T> {
      return sqlClient.transaction((tx) => fn(txClient(tx)));
    },
  };
}
