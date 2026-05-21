import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertDatabaseName } from '@pkgs/sqlite';

/** Single shared local database name. No per-account file split. */
export const MAIN_SQLITE_DB_NAME = 'main';

/**
 * Opens the one and only client SQLite database (`main`) on every platform
 * (expo-sqlite native + sql.js OPFS on web). The patch-db schema migrations
 * run later inside `createPatchDb` via `PatchDbImplSqlite.migrate()`, so this
 * function only worries about establishing a connected `SqlClient`.
 */
export async function openMainSqlClient(): Promise<SqlClient> {
  assertDatabaseName(MAIN_SQLITE_DB_NAME);
  const client = await SqlClientImplExpoSqlite.open(MAIN_SQLITE_DB_NAME);
  await client.connect();
  return client;
}
