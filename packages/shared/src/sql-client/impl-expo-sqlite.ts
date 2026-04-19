import * as SQLite from 'expo-sqlite';
import type { PreparedStatement, RunResult, SqlClient } from './interface';

/**
 * True when the local DB file is missing, corrupt, or otherwise unusable —
 * safe to delete and recreate (one retry only).
 */
function isRecoverableSqliteOpenError(err: unknown): boolean {
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    s.includes('sqlite3_open') ||
    s.includes('sqlite_corrupt') ||
    s.includes('sqlite_notadb') ||
    s.includes('database disk image is malformed') ||
    s.includes('file is not a database') ||
    s.includes('malformed') ||
    s.includes('corrupt')
  );
}

export class SqlClientImplExpoSqlite implements SqlClient {
  private txQueue: Promise<unknown> = Promise.resolve();

  constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(databaseName: string): Promise<SqlClientImplExpoSqlite> {
    try {
      const db = await SQLite.openDatabaseAsync(databaseName, {});
      return new SqlClientImplExpoSqlite(db);
    } catch (first: unknown) {
      if (!isRecoverableSqliteOpenError(first)) {
        throw first;
      }
      // Stale or corrupt OPFS / file handle from older builds — remove and retry once.
      await SQLite.deleteDatabaseAsync(databaseName).catch(() => {});
      console.warn(
        `[SqlClientImplExpoSqlite] Removed unreadable local database "${databaseName}" and retrying open.`,
      );
      const db = await SQLite.openDatabaseAsync(databaseName, {});
      return new SqlClientImplExpoSqlite(db);
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
    params?: unknown[]
  ): Promise<T[]> {
    return this.db.getAllAsync<T>(
      sql,
      (params ?? []) as SQLite.SQLiteBindValue[]
    );
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const result = await this.db.runAsync(
      sql,
      (params ?? []) as SQLite.SQLiteBindValue[]
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
