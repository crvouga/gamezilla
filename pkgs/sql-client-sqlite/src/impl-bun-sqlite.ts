import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { assert } from '@pkgs/assert';
import type { Sql, Value } from '@pkgs/sql';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client/interface';
import { applySqliteConnectionPragmas } from './connection-pragmas';

import { createTransactionChain } from './transaction-chain';

export class SqlClientImplBunSqlite implements SqlClient {
  private readonly enqueueTxn = createTransactionChain();

  constructor(private db: Database) {}

  static open(databasePath: string): SqlClientImplBunSqlite {
    const db = new Database(databasePath);
    return new SqlClientImplBunSqlite(db);
  }

  /** Ephemeral in-memory DB for Bun-hosted harness clients. */
  static openMemory(): SqlClientImplBunSqlite {
    return new SqlClientImplBunSqlite(new Database(':memory:'));
  }

  /** Restore from a prior {@link serializeBytes} image. */
  static openFromBytes(bytes: Uint8Array): SqlClientImplBunSqlite {
    // bun:sqlite accepts Uint8Array at runtime; typings only list string paths.
    return new SqlClientImplBunSqlite(new Database(bytes as unknown as string));
  }

  serializeBytes(): Uint8Array {
    return new Uint8Array(this.db.serialize());
  }

  importBytes(bytes: Uint8Array): void {
    this.db.close(false);
    this.db = new Database(bytes as unknown as string);
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

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const bindings = query.values as SQLQueryBindings[];
    const rows = this.db.query(query.sql).all(...bindings) as T[];
    return Promise.resolve(rows);
  }

  async run(query: Sql<unknown>): Promise<RunResult> {
    const bindings = query.values as SQLQueryBindings[];
    const result = this.db.query(query.sql).run(...bindings);
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const stmt = this.db.query(query.sql);
    return {
      query: <T = Record<string, unknown>>(params?: Value[]) => {
        const bindings = (params ?? []) as SQLQueryBindings[];
        return Promise.resolve(stmt.all(...bindings) as T[]);
      },
      run: (params?: Value[]) => {
        const bindings = (params ?? []) as SQLQueryBindings[];
        const result = stmt.run(...bindings);
        return Promise.resolve({
          changes: result.changes,
          lastInsertRowid: Number(result.lastInsertRowid),
        });
      },
    };
  }

  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.enqueueTxn(() => this.execTransaction(fn));
  }

  private async execTransaction<T>(
    fn: (tx: SqlClient) => Promise<T>
  ): Promise<T> {
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
