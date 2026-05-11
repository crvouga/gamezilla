import { SqlClientImplExpoSqlite } from '@gamezilla/lib/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { assertDatabaseName } from '@gamezilla/lib/sqlite';

/** Single shared local database name. No per-account file split. */
export const MAIN_SQLITE_DB_NAME = 'main';

// #region agent log
function _debugLog(message: string, data: Record<string, unknown>): void {
  if (typeof fetch === 'undefined') return;
  fetch(
    'http://127.0.0.1:7510/ingest/c52c9028-9c01-42a4-9186-01f9b18984a5',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '165003',
      },
      body: JSON.stringify({
        sessionId: '165003',
        location: 'open-main-sql-client.ts',
        message,
        data,
        timestamp: Date.now(),
      }),
    }
  ).catch(() => {});
}
let _openCounter = 0;
// #endregion

/**
 * Opens the one and only client SQLite database (`main`) on every platform
 * (expo-sqlite native + sql.js OPFS on web). The patch-db schema migrations
 * run later inside `createPatchDb` via `PatchDbImplSqlite.migrate()`, so this
 * function only worries about establishing a connected `SqlClient`.
 */
export async function openMainSqlClient(): Promise<SqlClient> {
  // #region agent log
  _openCounter += 1;
  const id = _openCounter;
  _debugLog('openMainSqlClient START', { hypothesisId: 'C', callId: id });
  // #endregion
  assertDatabaseName(MAIN_SQLITE_DB_NAME);
  try {
    const client = await SqlClientImplExpoSqlite.open(MAIN_SQLITE_DB_NAME);
    // #region agent log
    _debugLog('openMainSqlClient OPEN_OK', { hypothesisId: 'C', callId: id });
    // #endregion
    await client.connect();
    // #region agent log
    _debugLog('openMainSqlClient CONNECT_OK', {
      hypothesisId: 'C',
      callId: id,
    });
    // #endregion
    return client;
  } catch (err) {
    // #region agent log
    _debugLog('openMainSqlClient ERROR', {
      hypothesisId: 'C',
      callId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    // #endregion
    throw err;
  }
}
