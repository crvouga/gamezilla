import type { Timers } from '@pkgs/clock';
import { assertDatabaseName } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import { createExpoWebSqlClient } from '@pkgs/sql-client/sqlite/web';
import type { CreateId } from '@pkgs/uuid';
import { Platform } from 'react-native';

import { resolveSqliteDbName } from './resolve-sqlite-db-name';

export { resolveSqliteDbName } from './resolve-sqlite-db-name';

/**
 * Resolves the local SQLite database name for this app instance from the
 * bound `users.id`. Not memoized — identity switches change the name.
 *
 * On web, tabs share one DB per user (multi-tab broker owns OPFS); no per-tab suffix.
 */
export function getMainSqliteDbName(
  userId: string | null,
  _createId: CreateId
): string {
  if (userId === null || userId.length === 0) {
    const fallback = 'user_pending';
    assertDatabaseName(fallback);
    return fallback;
  }
  return resolveSqliteDbName({ userId });
}

/**
 * Opens the local client SQLite database on every platform (expo-sqlite
 * native + multi-tab-safe OPFS broker on web). Local sync schema migration
 * runs after open.
 */
export async function openMainSqlClient(
  userId: string,
  createId: CreateId,
  timers: Timers
): Promise<SqlClient> {
  const databaseName = getMainSqliteDbName(userId, createId);
  if (Platform.OS === 'web') {
    const client = createExpoWebSqlClient(databaseName, { timers });
    await client.connect();
    return client;
  }
  const client = await SqlClientImplExpoSqlite.open(databaseName, timers);
  await client.connect();
  return client;
}
