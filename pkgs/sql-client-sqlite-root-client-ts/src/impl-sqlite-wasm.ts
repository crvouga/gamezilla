/**
 * In-memory SQLite WASM {@link SqlClient} for browser harness clients (product-harness).
 *
 * Uses `@sqlite.org/sqlite-wasm` Memory VFS (`:memory:`) so Alice/Bob can
 * coexist without OPFS locks. Not for product web OPFS paths.
 *
 * Browser: load from `/generated/sqlite-wasm/index.mjs` as a *native* ESM
 * (import.meta.url works). Never value-import the npm package into the classic
 * bundle — classic scripts reject `import.meta`.
 */

import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import { applySqliteConnectionPragmas } from '@pkgs/sql-client-sqlite-root-shared-ts/connection-pragmas';
import type { Sql, Value } from '@pkgs/sql-root-shared-ts/sql';
import type sqlite3InitModule from '@sqlite.org/sqlite-wasm';

type Sqlite3Static = Awaited<ReturnType<typeof sqlite3InitModule>>;
type WasmDatabase = InstanceType<Sqlite3Static['oo1']['DB']>;
type Sqlite3InitModule = typeof sqlite3InitModule;

let sqlite3Promise: Promise<Sqlite3Static> | null = null;

function isBrowserPlayground(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Bun === 'undefined'
  );
}

async function importSqlite3Init(): Promise<Sqlite3InitModule> {
  if (isBrowserPlayground()) {
    // Runtime URL — the bundler must not rewrite this into the classic bundle.
    const href = new URL(
      '/generated/sqlite-wasm/index.mjs',
      window.location.href
    ).href;
    const mod: unknown = await import(/* webpackIgnore: true */ href);
    if (typeof mod === 'function') {
      return mod as Sqlite3InitModule;
    }
    const withDefault = mod as { default?: unknown };
    assert.ok(
      typeof withDefault.default === 'function',
      'sqlite-wasm init missing'
    );
    return withDefault.default as Sqlite3InitModule;
  }
  const mod = await import('@sqlite.org/sqlite-wasm');
  return mod.default;
}

function loadSqlite3(): Promise<Sqlite3Static> {
  if (sqlite3Promise === null) {
    sqlite3Promise = importSqlite3Init().then((init) => init());
  }
  return sqlite3Promise;
}

function openDb(sqlite3: Sqlite3Static, bytes?: Uint8Array): WasmDatabase {
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

import { createTransactionChain } from '@pkgs/sql-client-sqlite-root-shared-ts/transaction-chain';

export class SqlClientImplSqliteWasm implements SqlClient {
  private readonly enqueueTxn = createTransactionChain();

  private constructor(
    private readonly sqlite3: Sqlite3Static,
    private db: WasmDatabase
  ) {}

  static async open(bytes?: Uint8Array): Promise<SqlClientImplSqliteWasm> {
    const sqlite3 = await loadSqlite3();
    return new SqlClientImplSqliteWasm(sqlite3, openDb(sqlite3, bytes));
  }

  async connect(): Promise<void> {
    try {
      this.db.exec('SELECT 1');
      await applySqliteConnectionPragmas(this);
    } catch (err) {
      assert.ok(false, 'Database connection failed', { error: err });
    }
  }

  disconnect(): Promise<void> {
    try {
      if (this.db.isOpen()) this.db.close();
      return Promise.resolve();
    } catch (err) {
      assert.ok(false, 'Database disconnection failed', { error: err });
    }
  }

  exportDatabaseBytes(): Uint8Array {
    return this.sqlite3.capi.sqlite3_js_db_export(this.db);
  }

  importDatabaseBytes(bytes: Uint8Array): void {
    if (this.db.isOpen()) this.db.close();
    this.db = openDb(this.sqlite3, bytes);
  }

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const stmt = this.db.prepare(query.sql);
    try {
      bindValues(stmt, query.values);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.get({}) as T);
      }
      return Promise.resolve(rows);
    } finally {
      stmt.finalize();
    }
  }

  run(query: Sql<unknown>): Promise<RunResult> {
    const stmt = this.db.prepare(query.sql);
    try {
      bindValues(stmt, query.values);
      stmt.step();
      return Promise.resolve({
        changes: Number(this.db.changes()),
        lastInsertRowid: Number(
          this.sqlite3.capi.sqlite3_last_insert_rowid(this.db)
        ),
      });
    } finally {
      stmt.finalize();
    }
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const sqlText = query.sql;
    return {
      query: <R = Record<string, unknown>>(params?: Value[]) => {
        const stmt = this.db.prepare(sqlText);
        try {
          bindValues(stmt, params ?? []);
          const rows: R[] = [];
          while (stmt.step()) {
            rows.push(stmt.get({}) as R);
          }
          return Promise.resolve(rows);
        } finally {
          stmt.finalize();
        }
      },
      run: (params?: Value[]) => {
        const stmt = this.db.prepare(sqlText);
        try {
          bindValues(stmt, params ?? []);
          stmt.step();
          return Promise.resolve({
            changes: Number(this.db.changes()),
            lastInsertRowid: Number(
              this.sqlite3.capi.sqlite3_last_insert_rowid(this.db)
            ),
          });
        } finally {
          stmt.finalize();
        }
      },
    };
  }

  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.enqueueTxn(() => this.execTransaction(fn));
  }

  private async execTransaction<T>(
    fn: (tx: SqlClient) => Promise<T>
  ): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}
