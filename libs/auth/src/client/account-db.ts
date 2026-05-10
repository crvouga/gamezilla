/**
 * Per-account local SQLite (Expo) — structural isolation without SQLCipher.
 *
 * **Web note:** `sqlClientAtom` opens patch-db with **sql.js** in-memory (see
 * `apps/client/src/runtime/open-sql-client.ts`); this module is for **native** file-backed opens only.
 *
 * **Invariant:** Callers (Jotai `sqlClientAtom`) own at most one open connection at a time;
 * abort the previous `SqlClient` before opening another. All native opens for patch-db
 * should go through this module plus {@link SqlClientImplExpoSqlite}; do not call
 * `expo-sqlite.openDatabaseAsync` elsewhere.
 *
 * **Threat model:** Prevents cross-account data exposure through normal app queries and
 * bugs that target the wrong identity — each account's patches and snapshots live in a
 * separate file. This does **not** protect against an attacker with filesystem access:
 * SQLite files are unencrypted at rest (Expo Go cannot ship SQLCipher). Do not store
 * secrets on-device that would be unacceptable if the device is compromised.
 *
 * **Filenames:** `app_account_<uuid32hex>` / `app_anonymous_<uuid32hex>` (hyphens stripped)
 * so names satisfy {@link assertDatabaseName} and remain parseable for discovery UI.
 *
 * @module @gamezilla/client/db/account-db
 */

import {
  accountDatabaseBasename,
  anonymousDatabaseBasename,
  tryParseAccountDatabaseBasename,
  type LocalAccountDbInfo,
} from '@gamezilla/client/db/account-db-paths';
import { runAccountDatabaseMigrations } from '@gamezilla/client/db/account-migrations';
import { assertDatabaseName } from '@gamezilla/lib/sqlite';
import { SqlClientImplExpoSqlite } from '@gamezilla/lib/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export type { LocalAccountDbInfo } from '@gamezilla/client/db/account-db-paths';

const SQLITE_SUBDIR = 'gamezilla_sqlite_accounts';

/** `expo-file-system` v19 types omit legacy path constants on the namespace import. */
function expoLegacyFileSystem(): typeof FileSystem & {
  documentDirectory: string | null;
  cacheDirectory: string | null;
} {
  return FileSystem as typeof FileSystem & {
    documentDirectory: string | null;
    cacheDirectory: string | null;
  };
}

/**
 * Ensures the managed subdirectory exists on native. On web, returns `undefined`
 * (expo-sqlite does not support a custom directory parameter on web).
 */
export async function ensureAccountDatabaseDirectory(): Promise<
  string | undefined
> {
  if (Platform.OS === 'web') {
    return undefined;
  }
  const fs = expoLegacyFileSystem();
  const root = fs.documentDirectory ?? fs.cacheDirectory ?? null;
  if (root === null || root.length === 0) {
    throw new Error(
      'ensureAccountDatabaseDirectory: documentDirectory and cacheDirectory are both unavailable'
    );
  }
  const dir = `${String(root)}${SQLITE_SUBDIR}/`.replace(/\/{2,}/g, '/');
  const info = await fs.getInfoAsync(dir);
  if (!info.exists) {
    await fs.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Opens the SQLite file for `accountId`, runs migrations, returns a connected client.
 * Caller must disconnect any prior client before opening another file.
 */
export async function openAccountDb(accountId: string): Promise<SqlClient> {
  const basename = accountDatabaseBasename(accountId);
  assertDatabaseName(basename);
  const dir = await ensureAccountDatabaseDirectory();
  const client = await SqlClientImplExpoSqlite.open(basename, dir);
  await client.connect();
  await runAccountDatabaseMigrations(client);
  return client;
}

/**
 * Opens the anonymous (pre-auth) SQLite file keyed by the local device id
 * (UUID generated on first launch and persisted to secure storage).
 */
export async function openAnonymousDb(deviceId: string): Promise<SqlClient> {
  const basename = anonymousDatabaseBasename(deviceId);
  assertDatabaseName(basename);
  const dir = await ensureAccountDatabaseDirectory();
  const client = await SqlClientImplExpoSqlite.open(basename, dir);
  await client.connect();
  await runAccountDatabaseMigrations(client);
  return client;
}

/**
 * Deletes the on-disk file for `accountId`. Caller must ensure no `SqlClient` holds
 * this file open (e.g. abort previous atom derivation before calling).
 */
export async function deleteAccountLocalData(accountId: string): Promise<void> {
  const basename = accountDatabaseBasename(accountId);
  assertDatabaseName(basename);
  const dir =
    Platform.OS === 'web' ? undefined : await ensureAccountDatabaseDirectory();
  if (dir !== undefined && dir.length > 0) {
    await SQLite.deleteDatabaseAsync(basename, dir);
  } else {
    await SQLite.deleteDatabaseAsync(basename);
  }
}

/**
 * Best-effort removal of the anonymous DB file for `deviceId` (e.g. after sign-in when
 * guest data is discarded). Does not throw if the file is missing.
 */
export async function deleteAnonymousDatabaseFileBestEffort(
  deviceId: string
): Promise<void> {
  const basename = anonymousDatabaseBasename(deviceId);
  assertDatabaseName(basename);
  try {
    const dir =
      Platform.OS === 'web'
        ? undefined
        : await ensureAccountDatabaseDirectory();
    if (dir !== undefined && dir.length > 0) {
      await SQLite.deleteDatabaseAsync(basename, dir);
    } else {
      await SQLite.deleteDatabaseAsync(basename);
    }
  } catch {
    // File may already be gone — sign-in discard is best-effort.
  }
}

/**
 * Lists known per-account / anonymous database files under the managed directory.
 * On web, returns an empty list (native directory layout does not apply).
 */
export async function listLocalAccountDatabases(): Promise<
  LocalAccountDbInfo[]
> {
  if (Platform.OS === 'web') {
    return [];
  }
  const dir = await ensureAccountDatabaseDirectory();
  if (dir === undefined) return [];
  const listing = await expoLegacyFileSystem().readDirectoryAsync(dir);
  const out: LocalAccountDbInfo[] = [];
  for (const name of listing) {
    const parsed = tryParseAccountDatabaseBasename(name);
    if (parsed !== null) out.push(parsed);
  }
  out.sort((a, b) => a.basename.localeCompare(b.basename));
  return out;
}
