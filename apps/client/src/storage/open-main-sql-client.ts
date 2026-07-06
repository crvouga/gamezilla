import { assertDatabaseName } from '@pkgs/sql';
import { tryAcquireExpoSqliteWebSessionLock } from '@pkgs/sql-client/expo-sqlite-web-session-lock';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Platform } from 'react-native';

/** Base local database name. Used as-is on native. */
export const MAIN_SQLITE_DB_NAME = 'main';
assertDatabaseName(MAIN_SQLITE_DB_NAME);

/** `sessionStorage` key holding this tab's database id (web only). */
const WEB_TAB_DB_ID_KEY = 'main-sqlite-tab-id';

let cachedDbName: string | undefined;

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
 * Resolves the local SQLite database name for this app instance.
 *
 * Native (iOS / Android) uses the single shared `main` file. On web,
 * expo-sqlite persists through OPFS, and multiple tabs of the same origin
 * would contend for one OPFS handle if they shared a name. To keep tabs
 * independent we give each tab its own `main_<tabId>` database, where the
 * tab id lives in `sessionStorage` (isolated per tab, stable across reloads
 * of that tab, fresh for a new tab).
 *
 * Memoized at the module level so the name is stable for the tab's lifetime.
 */
export function getMainSqliteDbName(): string {
  if (cachedDbName !== undefined) {
    return cachedDbName;
  }
  const name =
    Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
      ? `${MAIN_SQLITE_DB_NAME}_${readOrCreateWebTabDbId()}`
      : MAIN_SQLITE_DB_NAME;
  assertDatabaseName(name);
  cachedDbName = name;
  return name;
}

/**
 * Opens the local client SQLite database on every platform (expo-sqlite
 * native + OPFS on web). The patch-db schema migrations run later
 * inside `createPatchDb` via `PatchDbImplSqlite.migrate()`, so this function
 * only worries about establishing a connected `SqlClient`.
 */
export async function openMainSqlClient(): Promise<SqlClient> {
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b580fa'},body:JSON.stringify({sessionId:'b580fa',location:'open-main-sql-client.ts:openMainSqlClient:start',message:'sql boot start',hypothesisId:'H5',data:{dbName:getMainSqliteDbName()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  await tryAcquireExpoSqliteWebSessionLock();
  const databaseName = getMainSqliteDbName();
  const client = await SqlClientImplExpoSqlite.open(databaseName);
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b580fa'},body:JSON.stringify({sessionId:'b580fa',location:'open-main-sql-client.ts:openMainSqlClient:opened',message:'sql opened',hypothesisId:'H5',data:{dbName:databaseName},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  await client.connect();
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b580fa'},body:JSON.stringify({sessionId:'b580fa',location:'open-main-sql-client.ts:openMainSqlClient:connected',message:'sql connected',hypothesisId:'H5',data:{dbName:databaseName},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return client;
}
