/**
 * Platform-specific local SQLite for patch-db: **web** uses in-memory sql.js
 * (multi-tab safe); **native** uses expo-sqlite files via `account-db.ts`.
 *
 * Takes explicit getters so this module does not import {@link ./atoms} (avoids cycles).
 *
 * @module @gamezilla/client/runtime/open-sql-client
 */

import {
  openAccountDb,
  openAnonymousDb,
} from '@gamezilla/client/db/account-db';
import { runAccountDatabaseMigrations } from '@gamezilla/client/db/account-migrations';
import { ensureServerClientId } from '@gamezilla/client/db/ensure-server-client-id';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { SqlClientImplSqlJs } from '@gamezilla/lib/sql-client/impl-sql-js';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { Platform } from 'react-native';

export type OpenSqlClientRuntimeDeps = {
  getAccountId: () => string | null;
  getSecureStorage: () => SecureStorage;
  getApiUrl: () => string;
};

/**
 * Resolve sql.js wasm against `window.location.origin` (not `document.baseURI`) so
 * SPA deep reloads still load `/sql-wasm-browser.wasm` from `apps/client/public`
 * (see `scripts/bundle-sqljs-wasm.ts`).
 */
function locateSqlJsWasmFile(file: string): string {
  if (typeof window === 'undefined') return file;
  return new URL(`/${file}`, window.location.origin).href;
}

/**
 * Web: in-memory sql.js — one DB per tab, no expo-sqlite OPFS worker. Expo-sqlite on
 * web (including `:memory:`) shares OPFS contention across tabs; sql.js avoids that.
 * Runs the same account DB migrations as native file opens (`runAccountDatabaseMigrations`).
 */
async function openWebSqlMain(signal: AbortSignal): Promise<SqlClient> {
  const client = await SqlClientImplSqlJs.openMemory({
    locateFile: locateSqlJsWasmFile,
  });
  await client.connect();
  await runAccountDatabaseMigrations(client);
  signal.addEventListener(
    'abort',
    () => {
      void client.disconnect();
    },
    { once: true }
  );
  return client;
}

/**
 * **Native:** per-account or anonymous file DB via expo-sqlite (`account-db.ts`).
 * Pre-auth uses a server-issued `clientId` for a stable anonymous filename.
 *
 * **Web:** sql.js in-memory — avoids expo-sqlite OPFS multi-tab lock.
 */
export async function openSqlClientForPlatform(
  deps: OpenSqlClientRuntimeDeps,
  signal: AbortSignal
): Promise<SqlClient> {
  if (Platform.OS === 'web') {
    return openWebSqlMain(signal);
  }
  const accountId = deps.getAccountId();
  const storage = deps.getSecureStorage();
  const apiUrl = deps.getApiUrl();
  if (accountId !== null) {
    return openAccountDb(accountId);
  }
  return openAnonymousDb(await ensureServerClientId(apiUrl, storage));
}
