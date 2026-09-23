/**
 * Browser local SQLite: multi-tab-safe OPFS broker from
 * `@pkgs/sql-client-sqlite-web`. Local sync schema migration runs after open.
 * Loaded on demand from `wall-client-env` so the web SQLite client stays off
 * first load; database naming lives in `./main-sqlite-db-name`.
 */

import type { Timers } from '@pkgs/clock';
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createWebSqlClient } from '@pkgs/sql-client-sqlite-web/web-sql-client';
import { getMainSqliteDbName } from './main-sqlite-db-name';

export async function openMainSqlClient(
  userId: string,
  timers: Timers,
  logger: Logger
): Promise<SqlClient> {
  try {
    const client = createWebSqlClient(getMainSqliteDbName(userId), {
      timers,
      logger,
    });
    await client.connect();
    return client;
  } catch {
    // Local SQLite is an optimistic cache. A stale worker, broken OPFS
    // handle, or corrupt snapshot must never block application boot.
    return openDisposableSqlClient();
  }
}

/**
 * A connected in-memory SQLite client for when the OPFS cache is unusable.
 * Imported on demand: this module is on the boot path and the in-memory
 * engine is ~80 KB gzip that only the failure path needs. Every fallback
 * goes through here — one static import anywhere in the client graph lets
 * the bundler co-locate shared helpers into that chunk and pull it eager.
 */
export async function openDisposableSqlClient(): Promise<SqlClient> {
  const { SqlClientImplSqliteMem } = await import(
    '@pkgs/sql-client-sqlite/impl-sqlite-mem'
  );
  const client = SqlClientImplSqliteMem.open();
  await client.connect();
  return client;
}
