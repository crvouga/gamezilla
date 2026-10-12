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
import { LOCAL_DATABASE, recordLocalDatabaseOpen } from './browser-boundaries';

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
    recordLocalDatabaseOpen(LOCAL_DATABASE.worker);
    return client;
  } catch (error) {
    // Local SQLite is an optimistic cache. A stale worker, broken OPFS
    // handle, or corrupt snapshot must never block application boot. The
    // disposable database runs on the main thread and keeps nothing, so say
    // so: a slow, forgetful app is otherwise the only sign.
    logger.warn(
      'local SQLite unavailable: using a disposable in-memory database on the main thread',
      { error: error instanceof Error ? error.message : String(error) }
    );
    return openDisposableSqlClient(error);
  }
}

/**
 * A connected disposable cache for when the real local database cannot be
 * used. `reason` is why, and is reported as a failed `db.open`.
 */
export async function openDisposableSqlClient(
  reason: unknown
): Promise<SqlClient> {
  recordLocalDatabaseOpen(LOCAL_DATABASE.memory, reason);
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  return client;
}
