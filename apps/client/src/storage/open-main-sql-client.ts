import { tryAcquireExpoSqliteWebSessionLock } from '@pkgs/sql-client/expo-sqlite-web-session-lock';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertDatabaseName } from '@pkgs/sql';
import { Platform } from 'react-native';

import { getCachedCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { getCachedDeviceId } from '@libs/auth/client/use-device-id';

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
 * Resolves the local SQLite database name for this app instance from secure
 * storage identity pointers. Not memoized — account switches change the name.
 */
export function getMainSqliteDbName(): string {
  const accountId = getCachedCurrentAccountId();
  const deviceId = getCachedDeviceId();
  if (deviceId === null || deviceId.length === 0) {
    const fallback = 'anon_pending';
    assertDatabaseName(fallback);
    return fallback;
  }
  const webTabSuffix =
    Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
      ? readOrCreateWebTabDbId()
      : undefined;
  return resolveSqliteDbName({
    accountId,
    deviceId,
    ...(webTabSuffix !== undefined ? { webTabSuffix } : {}),
  });
}

/**
 * Opens the local client SQLite database on every platform (expo-sqlite
 * native + OPFS on web). PowerSync schema setup runs later
 * inside `createPowerSyncDatabase` via PowerSync schema setup, so this function
 * only worries about establishing a connected `SqlClient`.
 */
export async function openMainSqlClient(): Promise<SqlClient> {
  await tryAcquireExpoSqliteWebSessionLock();
  const databaseName = getMainSqliteDbName();
  const client = await SqlClientImplExpoSqlite.open(databaseName);
  await client.connect();
  return client;
}
