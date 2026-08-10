import type { Timers } from '@pkgs/clock';
import { assertDatabaseName } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { tryAcquireExpoSqliteWebSessionLock } from '@pkgs/sql-client/sqlite/expo-web-session-lock';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import type { CreateId } from '@pkgs/uuid';
import { Platform } from 'react-native';

import { resolveSqliteDbName } from './resolve-sqlite-db-name';

export { resolveSqliteDbName } from './resolve-sqlite-db-name';

/** `sessionStorage` key holding this tab's database id (web only). */
const WEB_TAB_DB_ID_KEY = 'main-sqlite-tab-id';

function readOrCreateWebTabDbId(createId: CreateId): string {
  const existing = sessionStorage.getItem(WEB_TAB_DB_ID_KEY);
  if (existing !== null && existing.length > 0) {
    return existing;
  }
  const id = createId().replace(/-/g, '');
  sessionStorage.setItem(WEB_TAB_DB_ID_KEY, id);
  return id;
}

/**
 * Resolves the local SQLite database name for this app instance from the
 * bound `users.id`. Not memoized — identity switches change the name.
 */
export function getMainSqliteDbName(
  userId: string | null,
  createId: CreateId
): string {
  if (userId === null || userId.length === 0) {
    const fallback = 'user_pending';
    assertDatabaseName(fallback);
    return fallback;
  }
  const webTabSuffix =
    Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
      ? readOrCreateWebTabDbId(createId)
      : undefined;
  return resolveSqliteDbName({
    userId,
    ...(webTabSuffix !== undefined ? { webTabSuffix } : {}),
  });
}

/**
 * Opens the local client SQLite database on every platform (expo-sqlite
 * native + OPFS on web). Local sync schema migration runs after open.
 */
export async function openMainSqlClient(
  userId: string,
  createId: CreateId,
  timers: Timers
): Promise<SqlClient> {
  const databaseName = getMainSqliteDbName(userId, createId);
  await tryAcquireExpoSqliteWebSessionLock();
  const client = await SqlClientImplExpoSqlite.open(databaseName, timers);
  await client.connect();
  return client;
}
