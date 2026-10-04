import type { Sql, Value } from '@pkgs/sql-shared/sql';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-shared/interface';
import type sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { SqliteWorkerDatabase } from './sqlite-worker-host';

export type Sqlite3Static = Awaited<ReturnType<typeof sqlite3InitModule>>;
export type WasmDatabase = InstanceType<Sqlite3Static['oo1']['DB']>;

/** Open a fresh `:memory:` database, optionally seeded from an image. */
export function openMemoryDb(
  sqlite3: Sqlite3Static,
  bytes?: Uint8Array
): WasmDatabase {
  const db = new sqlite3.oo1.DB(':memory:', 'c');
  if (bytes !== undefined && bytes.byteLength > 0) {
    const p = sqlite3.wasm.allocFromTypedArray(bytes);
    const flags =
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
      sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE;
    const rc = sqlite3.capi.sqlite3_deserialize(
      db,
      'main',
      p,
      bytes.byteLength,
      bytes.byteLength,
      flags
    );
    sqlite3.oo1.DB.checkRc(db, rc);
  }
  return db;
}

function bindValues(
  stmt: ReturnType<WasmDatabase['prepare']>,
  values: readonly Value[]
): void {
  if (values.length === 0) return;
  stmt.bind(values as unknown as Parameters<typeof stmt.bind>[0]);
}

export type Oo1SqlClientArgs = {
  readonly sqlite3: Sqlite3Static;
  readonly db: WasmDatabase;
  /**
   * Replace the database contents with `bytes`. Receives the (already closed)
   * previous handle's filename and must return a freshly opened handle.
   */
  readonly reopenFromBytes: (bytes: Uint8Array) => Promise<WasmDatabase>;
};

/**
 * {@link SqlClient} over a `sqlite3.oo1.DB` handle. Works for any VFS
 * (`:memory:`, OPFS SAH pool). Statements are prepared per call — the worker
 * boundary already serializes access so there is no contention to amortize.
 */
export class Oo1SqlClient implements SqliteWorkerDatabase {
  private db: WasmDatabase;
  private readonly sqlite3: Sqlite3Static;
  private readonly reopenFromBytes: (
    bytes: Uint8Array
  ) => Promise<WasmDatabase>;

  constructor(args: Oo1SqlClientArgs) {
    this.sqlite3 = args.sqlite3;
    this.db = args.db;
    this.reopenFromBytes = args.reopenFromBytes;
  }

  connect(): Promise<void> {
    this.db.exec('SELECT 1');
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    if (this.db.isOpen()) this.db.close();
    return Promise.resolve();
  }

  exportDatabaseBytes(): Uint8Array {
    return this.sqlite3.capi.sqlite3_js_db_export(this.db);
  }

  async importDatabaseBytes(bytes: Uint8Array): Promise<void> {
    if (this.db.isOpen()) this.db.close();
    this.db = await this.reopenFromBytes(bytes);
  }

  private runResult(): RunResult {
    return {
      changes: Number(this.db.changes()),
      lastInsertRowid: Number(
        this.sqlite3.capi.sqlite3_last_insert_rowid(this.db)
      ),
    };
  }

  private queryRows<T>(sql: string, values: readonly Value[]): T[] {
    const stmt = this.db.prepare(sql);
    try {
      bindValues(stmt, values);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.get({}) as T);
      }
      return rows;
    } finally {
      stmt.finalize();
    }
  }

  private runOnce(sql: string, values: readonly Value[]): RunResult {
    const stmt = this.db.prepare(sql);
    try {
      bindValues(stmt, values);
      stmt.step();
      return this.runResult();
    } finally {
      stmt.finalize();
    }
  }

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    return Promise.resolve(this.queryRows<T>(query.sql, query.values));
  }

  run(query: Sql<unknown>): Promise<RunResult> {
    return Promise.resolve(this.runOnce(query.sql, query.values));
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    return {
      query: (params?: Value[]) =>
        Promise.resolve(this.queryRows<T>(query.sql, params ?? query.values)),
      run: (params?: Value[]) =>
        Promise.resolve(this.runOnce(query.sql, params ?? query.values)),
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error: unknown) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
