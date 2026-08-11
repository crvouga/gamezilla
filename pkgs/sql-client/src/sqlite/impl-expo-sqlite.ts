import type { Timers } from '@pkgs/clock';
import type { Sql, Value } from '@pkgs/sql';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import type { PreparedStatement, RunResult, SqlClient } from '../interface';
import { applySqliteConnectionPragmas } from './connection-pragmas';
import {
  formatErrorChain,
  mapExpoRunResult,
  sqliteCompatSql,
  WEB_OPFS_SOFT_RECOVERY_KEY,
  withOpenTimeout,
} from './expo-sqlite-core';
import {
  isRecoverableExpoSqliteWebRuntimeError,
  publishExpoSqliteWebFatalError,
} from './expo-web-recovery';
import { RESET_DB_QUERY_PARAM } from './web/opfs-recover';

export {
  isRecoverableExpoSqliteWebRuntimeError,
  subscribeExpoSqliteWebFatalError,
} from './expo-web-recovery';

export { RESET_DB_QUERY_PARAM } from './web/opfs-recover';

/** Call before manual Reset so soft recovery can run again if needed. */
export function clearExpoSqliteWebRecoverySessionFlag(): void {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(WEB_OPFS_SOFT_RECOVERY_KEY);
  }
}

/**
 * Runs before the first open attempt. When `?reset-db=1` is present, strip the
 * param and navigate to the wipe document.
 */
async function maybeHandleResetDbQueryParam(
  databaseName: string,
  timers: Timers
): Promise<void> {
  const { consumeResetDbQueryParamAndRecover } = await import(
    './web/opfs-recover'
  );
  await consumeResetDbQueryParamAndRecover(
    timers,
    `SqlClientImplExpoSqlite("${databaseName}")`
  );
}

async function openDatabaseOnce(
  databaseName: string,
  recovery: boolean,
  timers: Timers,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  return withOpenTimeout(
    databaseName,
    openDatabaseOnceInner(databaseName, recovery, directory),
    timers
  );
}

async function openDatabaseOnceInner(
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
 * Opens the local DB, recovering from common corruption issues.
 *
 * 1. First failure → `deleteDatabaseAsync` and retry (all platforms).
 * 2. Second failure on **web** → throw with Reset local data / `?reset-db=1`
 *    guidance (no main-thread OPFS wipe; multi-tab web uses owner-runtime soft
 *    recovery + wipe document instead).
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
    const done = this.opChain.then(async () => {
      try {
        return await fn();
      } catch (error) {
        if (isRecoverableExpoSqliteWebRuntimeError(error)) {
          publishExpoSqliteWebFatalError(
            error instanceof Error ? error : new Error(String(error))
          );
        }
        throw error;
      }
    });
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
      query: <T extends Record<string, unknown>>(query: Sql<T>) =>
        this.db.getAllAsync<T>(
          query.sql,
          query.values as SQLite.SQLiteBindValue[]
        ) as Promise<T[]>,
      run: async (query: Sql) => {
        const result = await this.db.runAsync(
          query.sql,
          query.values as SQLite.SQLiteBindValue[]
        );
        return mapExpoRunResult(result);
      },
      prepare: <T extends Record<string, unknown>>(query: Sql<T>) =>
        this.prepare(query),
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
    timers: Timers,
    directory?: string
  ): Promise<SqlClientImplExpoSqlite> {
    assertSecureContext();
    await maybeHandleResetDbQueryParam(databaseName, timers);
    const dir =
      Platform.OS === 'web' || directory === undefined || directory.length === 0
        ? undefined
        : directory;
    return openWithRecovery(databaseName, timers, dir);
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

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    return this.runSerialized(() =>
      this.db.getAllAsync<T>(
        sqliteCompatSql(query.sql),
        query.values as SQLite.SQLiteBindValue[]
      )
    );
  }

  async run(query: Sql<unknown>): Promise<RunResult> {
    return this.runSerialized(async () => {
      const result = await this.db.runAsync(
        sqliteCompatSql(query.sql),
        query.values as SQLite.SQLiteBindValue[]
      );
      return mapExpoRunResult(result);
    });
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const stmt = this.db.prepareSync(sqliteCompatSql(query.sql));
    return {
      query: async (params?: Value[]) =>
        this.runSerialized(async () => {
          const result = await stmt.executeAsync(
            (params ?? []) as SQLite.SQLiteBindParams
          );
          return result.getAllAsync() as Promise<T[]>;
        }),
      run: async (params?: Value[]) =>
        this.runSerialized(async () => {
          const result = await stmt.executeAsync(
            (params ?? []) as SQLite.SQLiteBindParams
          );
          return mapExpoRunResult(result);
        }),
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
    sessionStorage.removeItem(WEB_OPFS_SOFT_RECOVERY_KEY);
  }
  return client;
}

async function openWithRecovery(
  databaseName: string,
  timers: Timers,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  try {
    return await finishOpen(
      await openDatabaseOnce(databaseName, false, timers, directory)
    );
  } catch (first: unknown) {
    return openAfterFirstFailure(databaseName, first, timers, directory);
  }
}

async function deleteDbFile(
  databaseName: string,
  directory?: string
): Promise<void> {
  if (directory !== undefined && directory.length > 0) {
    await SQLite.deleteDatabaseAsync(databaseName, directory);
  } else {
    await SQLite.deleteDatabaseAsync(databaseName);
  }
}

async function openAfterFirstFailure(
  databaseName: string,
  first: unknown,
  timers: Timers,
  directory?: string
): Promise<SqlClientImplExpoSqlite> {
  await deleteDbFile(databaseName, directory);
  console.warn(
    `[SqlClientImplExpoSqlite] Open failed for "${databaseName}"; removed DB file and retrying once.`,
    first
  );
  try {
    return await finishOpen(
      await openDatabaseOnce(databaseName, true, timers, directory)
    );
  } catch (second: unknown) {
    if (Platform.OS !== 'web') throw second;
    throw buildWebOpenFailedError(databaseName, [second, first]);
  }
}

function buildWebOpenFailedError(
  databaseName: string,
  errors: unknown[]
): Error {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : 'this site';
  return new Error(
    `SQLite could not open the local database "${databaseName}". ` +
      `Close other tabs of ${origin}, then use Reset local data ` +
      `(or reload with ?${RESET_DB_QUERY_PARAM}=1). ` +
      `Underlying errors: ${formatErrorChain(errors)}`
  );
}
