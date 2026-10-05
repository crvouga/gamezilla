import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
/**
 * Browser local SQLite: multi-tab-safe OPFS broker from
 * `@pkgs/sql-client-sqlite-web`. Local sync schema migration runs after open.
 * Database naming lives in `./main-sqlite-db-name`.
 */

import { getMainSqliteDbName } from '@libs/app-root-shared/main-sqlite-db-name';
import type { Timers } from '@pkgs/clock-shared/types';
import type { Logger } from '@pkgs/logger-shared/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { createWebSqlClient } from '@pkgs/sql-client-sqlite-web-client/web-sql-client';

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

/** A connected disposable cache when OPFS is unavailable. */
export async function openDisposableSqlClient(): Promise<SqlClient> {
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  return client;
}
