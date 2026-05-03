/**
 * Per-account local SQLite (Expo) — structural isolation without SQLCipher.
 *
 * **Invariant:** At most one account (or anonymous) database file is open at a time.
 * Opening another closes the previous connection first. All native opens for patch-db
 * should go through this module plus {@link SqlClientImplExpoSqlite}; do not call
 * `expo-sqlite.openDatabaseAsync` elsewhere.
 *
 * **Threat model:** Prevents cross-account data exposure through normal app queries and
 * bugs that target the wrong identity — each account’s patches and snapshots live in a
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

export type AccountDbLogicalKey =
  | { readonly kind: 'account'; readonly accountId: string }
  | { readonly kind: 'anonymous'; readonly clientId: string };

export type AccountDatabaseSwitchHooks = {
  /**
   * Runs while the **old** SQLite file is still open. Tear down sync timers, React
   * subscriptions, and any UI bound to the old {@link PatchDb} before the file closes.
   */
  readonly beforeClose: () => Promise<void>;
  /** Runs after the new file is opened, migrated, and ready for patch-db bootstrap. */
  readonly afterOpen: () => Promise<void>;
};

const SQLITE_SUBDIR = 'gamezilla_sqlite_accounts';

let sqlClient: SqlClient | null = null;
/** Native absolute directory, or `null` on web (default expo-sqlite location). */
let databaseDirectory: string | null = null;
let currentBasename: string | null = null;
let currentKey: AccountDbLogicalKey | null = null;

let switchHooks: AccountDatabaseSwitchHooks | null = null;

/** Serializes open / close / switch so concurrent callers cannot corrupt singleton state. */
let chain: Promise<void> = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => {},
    () => {}
  );
  return run;
}

/**
 * Registers hooks invoked by {@link switchAccount} (not by bare `openAccountDb`).
 * Pass `null` to clear.
 */
export function registerAccountDatabaseSwitchHooks(
  hooks: AccountDatabaseSwitchHooks | null
): void {
  switchHooks = hooks;
}

/**
 * Ensures the managed subdirectory exists on native. On web, returns `undefined`
 * (expo-sqlite does not support a custom directory parameter on web).
 */
export async function ensureAccountDatabaseDirectory(): Promise<
  string | undefined
> {
  if (Platform.OS === 'web') {
    databaseDirectory = null;
    return undefined;
  }
  const root =
    FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? null;
  if (root === null || root.length === 0) {
    throw new Error(
      'ensureAccountDatabaseDirectory: documentDirectory and cacheDirectory are both unavailable'
    );
  }
  const dir = `${root}${SQLITE_SUBDIR}/`.replace(/\/{2,}/g, '/');
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  databaseDirectory = dir;
  return dir;
}

function assertSqlClientOpen(): void {
  if (sqlClient === null) {
    throw new Error(
      'No account database is open — call openAccountDb or openAnonymousDb first'
    );
  }
}

/**
 * Opens the SQLite file for `accountId`, closes any previously open account DB first,
 * runs migrations, and stores the singleton connection.
 */
export async function openAccountDb(
  accountId: string
): Promise<SQLite.SQLiteDatabase> {
  const basename = accountDatabaseBasename(accountId);
  assertDatabaseName(basename);
  return runExclusive(async () => {
    await closeSqlUnlocked();
    const dir = await ensureAccountDatabaseDirectory();
    await openSqlUnlocked(basename, { kind: 'account', accountId }, dir);
    return getExpoSqlClient().getSqliteDatabase();
  });
}

/**
 * Opens the anonymous (pre-auth) SQLite file keyed by server-issued `clientId`.
 */
export async function openAnonymousDb(
  clientId: string
): Promise<SQLite.SQLiteDatabase> {
  const basename = anonymousDatabaseBasename(clientId);
  assertDatabaseName(basename);
  return runExclusive(async () => {
    await closeSqlUnlocked();
    const dir = await ensureAccountDatabaseDirectory();
    await openSqlUnlocked(basename, { kind: 'anonymous', clientId }, dir);
    return getExpoSqlClient().getSqliteDatabase();
  });
}

/**
 * Returns the currently open `SQLiteDatabase`, or throws with a clear message if none.
 */
export function getCurrentAccountDb(): SQLite.SQLiteDatabase {
  return getExpoSqlClient().getSqliteDatabase();
}

/**
 * Returns the open {@link SqlClient} for patch-db bootstrap, or throws if none.
 */
export function getCurrentPatchSqlClient(): SqlClient {
  assertSqlClientOpen();
  return sqlClient as SqlClient;
}

/** Current logical identity for the open file, or `null` if none. */
export function getCurrentAccountDbKey(): AccountDbLogicalKey | null {
  return currentKey;
}

export function getCurrentAccountDatabaseBasename(): string | null {
  return currentBasename;
}

/**
 * Closes the current connection and clears singleton state (idempotent).
 */
export async function closeCurrentAccountDb(): Promise<void> {
  await runExclusive(async () => {
    await closeSqlUnlocked();
  });
}

/**
 * Atomic account switch: `beforeClose` → close SQLite → `openAccountDb` disk+migrate → `afterOpen`.
 * Hooks must tear down sync / React cache while the old DB is still open.
 */
export async function switchAccount(newAccountId: string): Promise<void> {
  const nextBasename = accountDatabaseBasename(newAccountId);
  assertDatabaseName(nextBasename);
  await runExclusive(async () => {
    const hooks = switchHooks;
    if (hooks !== null) {
      await hooks.beforeClose();
    }
    await closeSqlUnlocked();
    const dir = await ensureAccountDatabaseDirectory();
    await openSqlUnlocked(
      nextBasename,
      { kind: 'account', accountId: newAccountId },
      dir
    );
    if (hooks !== null) {
      await hooks.afterOpen();
    }
  });
}

/**
 * Deletes the on-disk file for `accountId`. If that file is currently open, closes it first.
 * Does not swallow errors.
 */
export async function deleteAccountLocalData(accountId: string): Promise<void> {
  const basename = accountDatabaseBasename(accountId);
  assertDatabaseName(basename);
  await runExclusive(async () => {
    const openForThis =
      currentKey?.kind === 'account' && currentKey.accountId === accountId;
    if (openForThis) {
      const hooks = switchHooks;
      if (hooks !== null) {
        await hooks.beforeClose();
      }
      await closeSqlUnlocked();
    }
    const dir =
      databaseDirectory ??
      (Platform.OS === 'web'
        ? undefined
        : await ensureAccountDatabaseDirectory());
    if (dir !== undefined && dir.length > 0) {
      await SQLite.deleteDatabaseAsync(basename, dir);
    } else {
      await SQLite.deleteDatabaseAsync(basename);
    }
  });
}

/**
 * Best-effort removal of the anonymous DB file for `clientId` (e.g. after sign-in when
 * guest data is discarded). Does not throw if the file is missing.
 */
export async function deleteAnonymousDatabaseFileBestEffort(
  clientId: string
): Promise<void> {
  const basename = anonymousDatabaseBasename(clientId);
  assertDatabaseName(basename);
  await runExclusive(async () => {
    const openForThis =
      currentKey?.kind === 'anonymous' && currentKey.clientId === clientId;
    if (openForThis) {
      const hooks = switchHooks;
      if (hooks !== null) {
        await hooks.beforeClose();
      }
      await closeSqlUnlocked();
    }
    try {
      const dir =
        databaseDirectory ??
        (Platform.OS === 'web'
          ? undefined
          : await ensureAccountDatabaseDirectory());
      if (dir !== undefined && dir.length > 0) {
        await SQLite.deleteDatabaseAsync(basename, dir);
      } else {
        await SQLite.deleteDatabaseAsync(basename);
      }
    } catch {
      // File may already be gone — sign-in discard is best-effort.
    }
  });
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
  const listing = await FileSystem.readDirectoryAsync(dir);
  const out: LocalAccountDbInfo[] = [];
  for (const name of listing) {
    const parsed = tryParseAccountDatabaseBasename(name);
    if (parsed !== null) out.push(parsed);
  }
  out.sort((a, b) => a.basename.localeCompare(b.basename));
  return out;
}

async function closeSqlUnlocked(): Promise<void> {
  if (sqlClient !== null) {
    await sqlClient.disconnect();
    sqlClient = null;
  }
  currentBasename = null;
  currentKey = null;
}

async function openSqlUnlocked(
  basename: string,
  key: AccountDbLogicalKey,
  directory: string | undefined
): Promise<void> {
  const client = await SqlClientImplExpoSqlite.open(basename, directory);
  await client.connect();
  await runAccountDatabaseMigrations(client);
  sqlClient = client;
  currentBasename = basename;
  currentKey = key;
}

function getExpoSqlClient(): SqlClientImplExpoSqlite {
  assertSqlClientOpen();
  const c = sqlClient;
  if (!(c instanceof SqlClientImplExpoSqlite)) {
    throw new Error('account-db: expected SqlClientImplExpoSqlite');
  }
  return c;
}
