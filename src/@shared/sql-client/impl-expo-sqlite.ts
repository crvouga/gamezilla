import * as SQLite from 'expo-sqlite';
import type { RunResult, SqlClient } from './interface';

export class SqlClientImplExpoSqlite implements SqlClient {
  constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(databaseName: string): Promise<SqlClientImplExpoSqlite> {
    const db = await SQLite.openDatabaseAsync(databaseName, {});
    return new SqlClientImplExpoSqlite(db);
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

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    let result: T;
    await this.db.withTransactionAsync(async () => {
      result = await fn(this);
    });
    return result!;
  }
}
