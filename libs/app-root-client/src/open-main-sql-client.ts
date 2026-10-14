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

/**
 * How long the real local database gets to open. Opening waits out a
 * previous page's handles (a reload, a navigation), which takes seconds, so
 * this is generous; past it the page runs on a disposable database and the
 * stuck open is abandoned in the background.
 */
export const LOCAL_DATABASE_OPEN_DEADLINE_MS = 8_000;

/**
 * How long a call to the open local database gets before it counts as a
 * storage failure. Longer than any healthy call, shorter than the 30s RPC
 * timeout beneath it.
 */
export const LOCAL_CALL_DEADLINE_MS = 10_000;

const disposableClients = new WeakSet<object>();

/** True for the stand-in that keeps nothing: this tab owns it alone. */
export function isDisposableSqlClient(client: SqlClient): boolean {
  return disposableClients.has(client);
}

function deadlineError(): Error {
  return new Error(
    `local SQLite did not open within ${LOCAL_DATABASE_OPEN_DEADLINE_MS}ms`
  );
}

/** Settles with `work`, or rejects once the open deadline passes. */
function withinOpenDeadline(
  work: Promise<void>,
  timers: Timers
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const handle = timers.setTimeout(
      () => reject(deadlineError()),
      LOCAL_DATABASE_OPEN_DEADLINE_MS
    );
    work.then(
      () => {
        timers.clearTimeout(handle);
        resolve();
      },
      (error: unknown) => {
        timers.clearTimeout(handle);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

/** Builds the browser database client for `dbName` (not yet connected). */
export type CreateWebSqlClient = (
  dbName: string,
  options: { readonly timers: Timers; readonly logger: Logger }
) => SqlClient;

export async function openMainSqlClient(
  userId: string,
  timers: Timers,
  logger: Logger,
  createClient: CreateWebSqlClient = createWebSqlClient
): Promise<SqlClient> {
  try {
    const client = createClient(getMainSqliteDbName(userId), {
      timers,
      logger,
    });
    try {
      await withinOpenDeadline(client.connect(), timers);
    } catch (error) {
      // A stuck open may still finish; let it release what it holds.
      void client.disconnect().catch(() => undefined);
      throw error;
    }
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
  disposableClients.add(client);
  return client;
}
