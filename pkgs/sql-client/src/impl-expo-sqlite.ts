import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { clearExpoSqliteWebOpfsBestEffort } from '@pkgs/sqlite/clear-expo-sqlite-web-opfs';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { applySqliteConnectionPragmas } from './sqlite-connection-pragmas';

/**
 * Set after we clear OPFS + reload once. While set, we must not clear OPFS again from the
 * main thread: the expo-sqlite worker keeps a live VFS; a second wipe desyncs it and
 * `sqlite3_open_v2` keeps failing until a new worker (navigation) — which matches “Clear site
 * data doesn’t help” because the tab immediately poisons itself again.
 */
const WEB_RECOVERY_RELOAD_KEY = 'expo-sqlite.web-recovery-reloaded';

/**
 * URL escape hatch. Appending `?reset-db=1` to any page of the app forces a full reset on
 * next load: clears the one-shot recovery flag, wipes OPFS, deletes the DB file, and strips
 * the query param so a subsequent reload behaves normally. Use this when a dev is stuck in
 * the "already survived one recovery reload" branch and DevTools isn't convenient.
 *
 * Exported so user-initiated "wipe local data" flows can reuse the same recovery code path
 * (otherwise the wipe runs while the live worker still holds OPFS access handles, which
 * silently leaves the SQLite file on disk).
 */
export const RESET_DB_QUERY_PARAM = 'reset-db';

/** Call before manual clear/reload so the one-time recovery reload can run again if needed. */
export function clearExpoSqliteWebRecoverySessionFlag(): void {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(WEB_RECOVERY_RELOAD_KEY);
  }
}

function formatErrorChain(parts: unknown[]): string {
  return parts
    .map((e) => (e instanceof Error ? e.message : String(e)))
    .filter((s) => s.length > 0)
    .join(' → ');
}

/** Runs before the first open attempt. Non-fatal: failures here are best-effort. */
async function maybeHandleResetDbQueryParam(
  databaseName: string
): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get(RESET_DB_QUERY_PARAM) !== '1') {
    return;
  }
  clearExpoSqliteWebRecoverySessionFlag();
  await clearExpoSqliteWebOpfsBestEffort();
  await SQLite.deleteDatabaseAsync(databaseName).catch(() => {});
  url.searchParams.delete(RESET_DB_QUERY_PARAM);
  window.history.replaceState(null, '', url.toString());
  console.warn(
    `[SqlClientImplExpoSqlite] ?${RESET_DB_QUERY_PARAM}=1 detected — wiped expo-sqlite OPFS and deleted "${databaseName}" before opening.`
  );
}

function buildLockedOpfsError(
  databaseName: string,
  clearError: unknown,
  previous: unknown[]
): Error {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : 'this site';
  const clearMessage =
    clearError instanceof Error ? clearError.message : String(clearError);
  return new Error(
    `SQLite could not open the local database "${databaseName}" and automatic recovery is blocked: ` +
      `another tab or worker is holding the OPFS handle (${clearMessage}). ` +
      `Fix: close every other tab of ${origin}, unregister any Service Worker in DevTools → Application → Service Workers, ` +
      `then reload with ?${RESET_DB_QUERY_PARAM}=1 appended to the URL (or use DevTools → Application → Clear site data). ` +
      `Underlying open errors: ${formatErrorChain(previous)}`
  );
}

async function openDatabaseOnce(
  databaseName: string,
  recovery: boolean,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  const opts =
    Platform.OS === 'web' && recovery ? { useNewConnection: true } : {};
  const db =
    directory !== undefined && directory.length > 0
      ? await SQLite.openDatabaseAsync(databaseName, opts, directory)
      : await SQLite.openDatabaseAsync(databaseName, opts);
  return new SqlClientImplExpoSqlite(db);
}

/**
 * Opens the local DB, recovering from common corruption / legacy OPFS issues.
 *
 * 1. First failure → `deleteDatabaseAsync` and retry (all platforms).
 * 2. Second failure on **web** → if we have not already done an OPFS wipe+reload this
 *    session, clear the `expo-sqlite` OPFS directory (main thread), `deleteDatabaseAsync`,
 *    then **reload** so the worker/WASM re-init. If we **already** did that reload (`sessionStorage`),
 *    we do **not** wipe OPFS again (that would desync the worker); we only use worker-side
 *    `deleteDatabaseAsync` and `useNewConnection` retries, then throw with a full error chain.
 */
export class SqlClientImplExpoSqlite implements SqlClient {
  /**
   * expo-sqlite's web worker uses an async `onmessage` handler, so multiple
   * worker messages can run `handleMessageImpl` concurrently before the first
   * `await` — overlapping prepare/finalize on one DB yields "Error finalizing
   * statement". Serialize **all** top-level {@link query}/{@link run}/
   * {@link transaction} on the main thread.
   *
   * Nested calls (e.g. `transaction` → `tx.run`) MUST bypass this queue or the
   * chain deadlocks. The bypass is done by exposing a separate `tx` object
   * inside {@link transaction} (see {@link buildBypassTx}) whose methods talk
   * directly to {@link SQLite.SQLiteDatabase}; we never use a global
   * "queueDepth" flag because that incorrectly bypasses *concurrent* external
   * callers as well, which causes `BEGIN within BEGIN` on the same connection.
   *
   * {@link disconnect} sets {@link disconnecting} synchronously so new top-level
   * work rejects immediately, then chains `closeAsync` on this tail so close
   * never runs while queued work is still in flight.
   */
  private opChain: Promise<unknown> = Promise.resolve();
  private closed = false;
  private disconnecting = false;
  private pendingDisconnect: Promise<void> | null = null;

  constructor(private db: SQLite.SQLiteDatabase) {}

  private runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    if (this.disconnecting || this.closed) {
      return Promise.reject(
        new Error(
          'SqlClientImplExpoSqlite: client disconnecting or already closed'
        )
      );
    }
    const done = this.opChain.then(() => fn());
    this.opChain = done.then(
      () => undefined,
      () => undefined
    );
    return done as Promise<T>;
  }

  private buildBypassTx(): SqlClient {
    const tx: SqlClient = {
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
        this.db.getAllAsync<T>(
          sql,
          (params ?? []) as SQLite.SQLiteBindValue[]
        ) as Promise<T[]>,
      run: async (sql: string, params?: unknown[]) => {
        const result = await this.db.runAsync(
          sql,
          (params ?? []) as SQLite.SQLiteBindValue[]
        );
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowId,
        };
      },
      prepare: (sql: string) => this.prepare(sql),
      transaction: async <T>(fn: (inner: SqlClient) => Promise<T>) => fn(tx),
    };
    return tx;
  }

  /**
   * Native-only: pass `directory` so the DB file lives under a managed folder
   * (e.g. per-account isolation). Ignored on web (expo-sqlite has no directory param).
   */
  static async open(
    databaseName: string,
    directory?: string
  ): Promise<SqlClientImplExpoSqlite> {
    assertSecureContext();
    await maybeHandleResetDbQueryParam(databaseName);
    const dir =
      Platform.OS === 'web' || directory === undefined || directory.length === 0
        ? undefined
        : directory;
    return openWithRecovery(databaseName, dir);
  }

  /** Underlying expo-sqlite handle (for modules that need `SQLiteDatabase`). */
  getSqliteDatabase(): SQLite.SQLiteDatabase {
    return this.db;
  }

  connect(): Promise<void> {
    return applySqliteConnectionPragmas(this);
  }

  disconnect(): Promise<void> {
    if (this.closed) {
      return Promise.resolve();
    }
    if (this.pendingDisconnect !== null) {
      return this.pendingDisconnect;
    }
    this.disconnecting = true;
    const done = this.opChain
      .then(async () => {
        await this.db.closeAsync();
      })
      .finally(() => {
        this.closed = true;
        this.disconnecting = false;
        this.pendingDisconnect = null;
      });
    this.pendingDisconnect = done;
    this.opChain = done.then(
      () => undefined,
      () => undefined
    );
    return this.pendingDisconnect;
  }

  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    return this.runSerialized(() =>
      this.db.getAllAsync<T>(sql, (params ?? []) as SQLite.SQLiteBindValue[])
    );
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    return this.runSerialized(async () => {
      const result = await this.db.runAsync(
        sql,
        (params ?? []) as SQLite.SQLiteBindValue[]
      );
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowId,
      };
    });
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepareSync(sql);
    return {
      query: async <T = Record<string, unknown>>(params?: unknown[]) => {
        const result = await stmt.executeAsync(
          (params ?? []) as SQLite.SQLiteBindParams
        );
        return result.getAllAsync() as Promise<T[]>;
      },
      run: async (params?: unknown[]) => {
        const result = await stmt.executeAsync(
          (params ?? []) as SQLite.SQLiteBindParams
        );
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowId,
        };
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.runSerialized(async () => {
      const tx = this.buildBypassTx();
      const ref: { value: T } = { value: undefined as unknown as T };
      await this.db.withTransactionAsync(async () => {
        ref.value = await fn(tx);
      });
      return ref.value;
    });
  }
}

function assertSecureContext(): void {
  if (Platform.OS !== 'web') return;
  if (typeof globalThis.isSecureContext !== 'boolean') return;
  if (globalThis.isSecureContext) return;
  throw new Error(
    'SQLite on web needs a secure context (HTTPS or localhost). Open the app over HTTPS or http://localhost.'
  );
}

async function finishOpen(
  client: SqlClientImplExpoSqlite
): Promise<SqlClientImplExpoSqlite> {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(WEB_RECOVERY_RELOAD_KEY);
  }
  return client;
}

async function openWithRecovery(
  databaseName: string,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  try {
    return await finishOpen(
      await openDatabaseOnce(databaseName, false, directory)
    );
  } catch (first: unknown) {
    return openAfterFirstFailure(databaseName, first, directory);
  }
}

async function deleteDbFile(
  databaseName: string,
  directory?: string
): Promise<void> {
  if (directory !== undefined && directory.length > 0) {
    await SQLite.deleteDatabaseAsync(databaseName, directory).catch(() => {});
  } else {
    await SQLite.deleteDatabaseAsync(databaseName).catch(() => {});
  }
}

async function openAfterFirstFailure(
  databaseName: string,
  first: unknown,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  await deleteDbFile(databaseName, directory);
  console.warn(
    `[SqlClientImplExpoSqlite] Open failed for "${databaseName}"; removed DB file and retrying once.`,
    first
  );
  try {
    return await finishOpen(
      await openDatabaseOnce(databaseName, true, directory)
    );
  } catch (second: unknown) {
    if (Platform.OS !== 'web') throw second;
    return openAfterSecondFailure(databaseName, first, second, directory);
  }
}

async function openAfterSecondFailure(
  databaseName: string,
  first: unknown,
  second: unknown,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  await deleteDbFile(databaseName, directory);
  const postOpfsReload =
    typeof sessionStorage !== 'undefined' &&
    Boolean(sessionStorage.getItem(WEB_RECOVERY_RELOAD_KEY));
  if (!postOpfsReload) {
    return openWithOpfsRecovery(databaseName, first, second, directory);
  }
  return openAfterOpfsRecovery(databaseName, first, second, directory);
}

async function openWithOpfsRecovery(
  databaseName: string,
  first: unknown,
  second: unknown,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  const clearResult = await clearExpoSqliteWebOpfsBestEffort();
  await deleteDbFile(databaseName, directory);
  if (!clearResult.ok) {
    // The wipe silently failing (e.g. `NoModificationAllowedError` because another
    // tab still holds a `FileSystemSyncAccessHandle`) used to set the session flag
    // and reload, which permanently poisoned the tab. Fail loudly instead.
    throw buildLockedOpfsError(databaseName, clearResult.error, [
      second,
      first,
    ]);
  }
  console.warn(
    `[SqlClientImplExpoSqlite] Open failed again; cleared expo-sqlite OPFS and reloading.`,
    second
  );
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(WEB_RECOVERY_RELOAD_KEY, '1');
    window.location.reload();
    return await new Promise<SqlClientImplExpoSqlite>(() => {});
  }
  throw second;
}

async function openAfterOpfsRecovery(
  databaseName: string,
  first: unknown,
  second: unknown,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  // Already survived one OPFS wipe + reload; never wipe OPFS again in this tab — it
  // breaks the worker VFS. Retry with fresh connections only.
  console.warn(
    `[SqlClientImplExpoSqlite] Open failed after OPFS recovery reload; retrying without main-thread OPFS wipe.`,
    second
  );
  try {
    return await finishOpen(
      await openDatabaseOnce(databaseName, true, directory)
    );
  } catch (third: unknown) {
    await deleteDbFile(databaseName, directory);
    try {
      return await finishOpen(
        await openDatabaseOnce(databaseName, true, directory)
      );
    } catch (fourth: unknown) {
      throw buildPostRecoveryError(databaseName, [
        fourth,
        third,
        second,
        first,
      ]);
    }
  }
}

function buildPostRecoveryError(
  databaseName: string,
  errors: unknown[]
): Error {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : 'this site';
  return new Error(
    `SQLite could not open the local database "${databaseName}" after a recovery reload. ` +
      `Another tab/worker of ${origin} is likely holding the OPFS handle. ` +
      `Fix: close every other tab of ${origin}, then reload with ?${RESET_DB_QUERY_PARAM}=1 appended to the URL ` +
      `(or use DevTools → Application → Clear site data). ` +
      `Underlying errors: ${formatErrorChain(errors)}`
  );
}
