import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import { applySqliteConnectionPragmas } from '@pkgs/sql-client-sqlite-root-shared-ts/connection-pragmas';
import { createSerializedSqliteClient } from '@pkgs/sql-client-sqlite-root-shared-ts/serialized-sqlite-client';
import type { Sql, Value } from '@pkgs/sql-root-shared-ts/sql';

export class SqlClientImplBunSqlite implements SqlClient {
  private readonly connection: SqlClient = {
    connect: () => this.connect(),
    disconnect: () => this.disconnect(),
    query: (query) => this.queryInConnection(query),
    run: (query) => this.runInConnection(query),
    prepare: (query) => this.prepareInConnection(query),
    transaction: (fn) => this.execTransaction(fn),
  };
  private readonly serialized = createSerializedSqliteClient(this.connection);
  query = this.serialized.query;
  run = this.serialized.run;
  prepare = this.serialized.prepare;
  transaction = this.serialized.transaction;

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

  private queryInConnection<T extends Record<string, unknown>>(
    query: Sql<T>
  ): Promise<T[]> {
    const bindings = query.values as SQLQueryBindings[];
    const rows = this.db.query(query.sql).all(...bindings) as T[];
    return Promise.resolve(rows);
  }

  private async runInConnection(query: Sql<unknown>): Promise<RunResult> {
    const bindings = query.values as SQLQueryBindings[];
    const result = this.db.query(query.sql).run(...bindings);
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  private prepareInConnection<T extends Record<string, unknown>>(
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

  private async execTransaction<T>(
    fn: (tx: SqlClient) => Promise<T>
  ): Promise<T> {
    this.db.run('BEGIN');
    try {
      const result = await fn(this.connection);
      this.db.run('COMMIT');
      return result;
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }
}
