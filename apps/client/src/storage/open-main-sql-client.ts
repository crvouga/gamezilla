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
  // #region agent log
  let lockSnapshot: unknown = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.locks?.query !== undefined) {
      lockSnapshot = await navigator.locks.query();
    }
  } catch {
    lockSnapshot = { queryFailed: true };
  }
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9554b'},body:JSON.stringify({sessionId:'c9554b',runId:'pre-fix',hypothesisId:'A',location:'open-main-sql-client.ts:before-lock',message:'openMainSqlClient before lock',data:{userIdLen:userId.length,databaseName,lockSnapshot},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  try {
    await tryAcquireExpoSqliteWebSessionLock();
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9554b'},body:JSON.stringify({sessionId:'c9554b',runId:'pre-fix',hypothesisId:'A',location:'open-main-sql-client.ts:lock-fail',message:'lock acquire failed',data:{databaseName,errorName:error instanceof Error?error.name:typeof error},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw error;
  }
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9554b'},body:JSON.stringify({sessionId:'c9554b',runId:'pre-fix',hypothesisId:'A',location:'open-main-sql-client.ts:after-lock',message:'lock acquired, opening sqlite',data:{databaseName},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const client = await SqlClientImplExpoSqlite.open(databaseName, timers);
  await client.connect();
  return client;
}
