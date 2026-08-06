import { tryAcquireExpoSqliteWebSessionLock } from '@pkgs/sql-client/sqlite/expo-web-session-lock';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertDatabaseName } from '@pkgs/sql';
import { Platform } from 'react-native';

import { resolveSqliteDbName } from './resolve-sqlite-db-name';

export { resolveSqliteDbName } from './resolve-sqlite-db-name';

/** `sessionStorage` key holding this tab's database id (web only). */
const WEB_TAB_DB_ID_KEY = 'main-sqlite-tab-id';

function readOrCreateWebTabDbId(): string {
  const existing = sessionStorage.getItem(WEB_TAB_DB_ID_KEY);
  if (existing !== null && existing.length > 0) {
    return existing;
  }
  const id = crypto.randomUUID().replace(/-/g, '');
  sessionStorage.setItem(WEB_TAB_DB_ID_KEY, id);
  return id;
}

/**
 * Resolves the local SQLite database name for this app instance from the
 * bound `users.id`. Not memoized — identity switches change the name.
 */
export function getMainSqliteDbName(userId: string | null): string {
  if (userId === null || userId.length === 0) {
    const fallback = 'user_pending';
    assertDatabaseName(fallback);
    return fallback;
  }
  const webTabSuffix =
    Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
      ? readOrCreateWebTabDbId()
      : undefined;
  return resolveSqliteDbName({
    userId,
    ...(webTabSuffix !== undefined ? { webTabSuffix } : {}),
  });
}

/**
 * Opens the local client SQLite database on every platform (expo-sqlite
 * native + OPFS on web). PowerSync schema setup runs later
 * inside `createPowerSyncDatabase` via PowerSync schema setup, so this function
 * only worries about establishing a connected `SqlClient`.
 */
export async function openMainSqlClient(userId: string): Promise<SqlClient> {
  await tryAcquireExpoSqliteWebSessionLock();
  const databaseName = getMainSqliteDbName(userId);
  const client = await SqlClientImplExpoSqlite.open(databaseName);
  await client.connect();
  return client;
}
