import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { assert } from '../assert';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { applySqliteConnectionPragmas } from './sqlite-connection-pragmas';

export class SqlClientImplBunSqlite implements SqlClient {
  constructor(private db: Database) {}

  static open(databasePath: string): SqlClientImplBunSqlite {
    const db = new Database(databasePath);
    return new SqlClientImplBunSqlite(db);
  }

  async connect(): Promise<void> {
    try {
      this.db.query('SELECT 1').get();
      await applySqliteConnectionPragmas(this);
    } catch (err) {
      assert.ok(false, 'Database connection failed', { error: err });
    }
  }

  disconnect(): Promise<void> {
    try {
      // false: sqlite3_close_v2 — defer close until statements finish; close(true) throws "database is locked".
      this.db.close(false);
      return Promise.resolve();
    } catch (err) {
      assert.ok(false, 'Database disconnection failed', { error: err });
    }
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

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.query(sql);
    return {
      query: <T = Record<string, unknown>>(params?: unknown[]) => {
        const bindings = (params ?? []) as SQLQueryBindings[];
        return Promise.resolve(stmt.all(...bindings) as T[]);
      },
      run: (params?: unknown[]) => {
        const bindings = (params ?? []) as SQLQueryBindings[];
        const result = stmt.run(...bindings);
        return Promise.resolve({
          changes: result.changes,
          lastInsertRowid: Number(result.lastInsertRowid),
        });
      },
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
