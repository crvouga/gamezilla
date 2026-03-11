import { Database, type SQLQueryBindings } from 'bun:sqlite';
import type { RunResult, SqlClient } from './interface';

export class SqlClientImplBunSqlite implements SqlClient {
  constructor(private db: Database) {}

  static open(databasePath: string): SqlClientImplBunSqlite {
    const db = new Database(databasePath);
    return new SqlClientImplBunSqlite(db);
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve(this.db.close());
  }

  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const bindings = (params ?? []) as SQLQueryBindings[];
    const rows = this.db.query(sql).all(...bindings) as T[];
    return Promise.resolve(rows);
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const bindings = (params ?? []) as SQLQueryBindings[];
    const result = this.db.query(sql).run(...bindings);
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    this.db.run('BEGIN');
    try {
      const result = await fn(this);
      this.db.run('COMMIT');
      return result;
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }
}
