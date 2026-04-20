import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { clearExpoSqliteWebOpfsBestEffort } from '../sqlite/clear-expo-sqlite-web-opfs';
import type { PreparedStatement, RunResult, SqlClient } from './interface';

/**
 * Set after we clear OPFS + reload once. While set, we must not clear OPFS again from the
 * main thread: the expo-sqlite worker keeps a live VFS; a second wipe desyncs it and
 * `sqlite3_open_v2` keeps failing until a new worker (navigation) — which matches “Clear site
 * data doesn’t help” because the tab immediately poisons itself again.
 */
const WEB_RECOVERY_RELOAD_KEY = 'gamezilla.expo-sqlite.web-recovery-reloaded';

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

async function openDatabaseOnce(
  databaseName: string,
  recovery: boolean,
): Promise<SqlClientImplExpoSqlite> {
  const opts =
    Platform.OS === 'web' && recovery ? { useNewConnection: true } : {};
  const db = await SQLite.openDatabaseAsync(databaseName, opts);
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
  private txQueue: Promise<unknown> = Promise.resolve();

  constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(databaseName: string): Promise<SqlClientImplExpoSqlite> {
    if (
      Platform.OS === 'web' &&
      typeof globalThis.isSecureContext === 'boolean' &&
      !globalThis.isSecureContext
    ) {
      throw new Error(
        'SQLite on web needs a secure context (HTTPS or localhost). Open the app over HTTPS or http://localhost.',
      );
    }

    const finish = async (
      client: SqlClientImplExpoSqlite,
    ): Promise<SqlClientImplExpoSqlite> => {
      if (
        Platform.OS === 'web' &&
        typeof sessionStorage !== 'undefined'
      ) {
        sessionStorage.removeItem(WEB_RECOVERY_RELOAD_KEY);
      }
      return client;
    };

    try {
      return await finish(await openDatabaseOnce(databaseName, false));
    } catch (first: unknown) {
      await SQLite.deleteDatabaseAsync(databaseName).catch(() => {});
      console.warn(
        `[SqlClientImplExpoSqlite] Open failed for "${databaseName}"; removed DB file and retrying once.`,
        first,
      );
      try {
        return await finish(await openDatabaseOnce(databaseName, true));
      } catch (second: unknown) {
        if (Platform.OS !== 'web') {
          throw second;
        }

        await SQLite.deleteDatabaseAsync(databaseName).catch(() => {});

        const postOpfsReload =
          typeof sessionStorage !== 'undefined' &&
          Boolean(sessionStorage.getItem(WEB_RECOVERY_RELOAD_KEY));

        if (!postOpfsReload) {
          await clearExpoSqliteWebOpfsBestEffort();
          await SQLite.deleteDatabaseAsync(databaseName).catch(() => {});
          console.warn(
            `[SqlClientImplExpoSqlite] Open failed again; cleared expo-sqlite OPFS and reloading.`,
            second,
          );
          if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(WEB_RECOVERY_RELOAD_KEY, '1');
            window.location.reload();
            return await new Promise<SqlClientImplExpoSqlite>(() => {});
          }
          throw second;
        }

        // Already survived one OPFS wipe + reload; never wipe OPFS again in this tab — it
        // breaks the worker VFS. Retry with fresh connections only.
        console.warn(
          `[SqlClientImplExpoSqlite] Open failed after OPFS recovery reload; retrying without main-thread OPFS wipe.`,
          second,
        );
        try {
          return await finish(await openDatabaseOnce(databaseName, true));
        } catch (third: unknown) {
          await SQLite.deleteDatabaseAsync(databaseName).catch(() => {});
          try {
            return await finish(await openDatabaseOnce(databaseName, true));
          } catch (fourth: unknown) {
            const err = new Error(
              `SQLite could not open the local database: ${formatErrorChain([fourth, third, second, first])}`,
            );
            throw err;
          }
        }
      }
    }
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return this.db.closeAsync();
  }

  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    return this.db.getAllAsync<T>(
      sql,
      (params ?? []) as SQLite.SQLiteBindValue[],
    );
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const result = await this.db.runAsync(
      sql,
      (params ?? []) as SQLite.SQLiteBindValue[],
    );
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowId,
    };
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepareSync(sql);
    return {
      query: async <T = Record<string, unknown>>(params?: unknown[]) => {
        const result = await stmt.executeAsync(
          (params ?? []) as SQLite.SQLiteBindParams,
        );
        return result.getAllAsync() as Promise<T[]>;
      },
      run: async (params?: unknown[]) => {
        const result = await stmt.executeAsync(
          (params ?? []) as SQLite.SQLiteBindParams,
        );
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowId,
        };
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    let resolve!: (v: unknown) => void;
    const gate = new Promise<unknown>((r) => {
      resolve = r;
    });
    const waiting = this.txQueue;
    this.txQueue = gate;

    await waiting;
    try {
      const ref: { value: T } = { value: undefined as unknown as T };
      await this.db.withTransactionAsync(async () => {
        ref.value = await fn(this);
      });
      return ref.value;
    } finally {
      resolve(undefined);
    }
  }
}
