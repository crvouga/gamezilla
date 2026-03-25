import initSqlJs from 'sql.js';
import { assert } from '../assert';
import type { PreparedStatement, RunResult, SqlClient } from './interface';

export type SqlJsInitConfig = Parameters<typeof initSqlJs>[0];

type SqlJs = Awaited<ReturnType<typeof initSqlJs>>;
type SqlDatabase = InstanceType<SqlJs['Database']>;
type SqlStatement = ReturnType<SqlDatabase['prepare']>;
/** sql.js bind/run params; SqlClient uses unknown[] at the API boundary. */
type SqlJsBindParams = NonNullable<Parameters<SqlStatement['bind']>[0]>;

/** One wasm load per JS realm (many in-memory DBs per module). */
let sharedSqlJsPromise: Promise<SqlJs> | null = null;

/** sql.js `SELECT changes(), last_insert_rowid()` right after a mutating statement. */
function readRunMeta(db: SqlDatabase): RunResult {
  const stmt = db.prepare('SELECT changes() AS c, last_insert_rowid() AS r');
  try {
    stmt.step();
    const row = stmt.getAsObject() as { c: number; r: number };
    return {
      changes: Number(row.c ?? 0),
      lastInsertRowid: Number(row.r ?? 0),
    };
  } finally {
    stmt.free();
  }
}

function rowsFromStatement(stmt: SqlStatement): Record<string, unknown>[] {
  const columns = stmt.getColumnNames();
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const values = stmt.get() as unknown[];
    const row: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      assert.defined(col, 'sql.js: column name missing for result row', {
        columnIndex: i,
        columnCount: columns.length,
      });
      row[col] = values[i];
    }
    rows.push(row);
  }
  return rows;
}

export class SqlClientImplSqlJs implements SqlClient {
  private constructor(private readonly db: SqlDatabase) {}

  /**
   * Opens an empty in-memory database.
   * In browsers, WASM is loaded via `locateFile` → https://sql.js.org/dist/… so `file://` viz bundles work.
   * In Bun/Node, omit `locateFile` (bundled wasm path) unless you override.
   */
  static async openMemory(config?: SqlJsInitConfig): Promise<SqlClientImplSqlJs> {
    const initConfig =
      config ??
      (typeof globalThis.document !== 'undefined'
        ? {
            /** Co-locate `sql-wasm-browser.wasm` with `index.html`, or pass an explicit Vite `?url` config. */
            locateFile: (file: string) =>
              new URL(file, globalThis.document.baseURI).href,
          }
        : undefined);
    if (sharedSqlJsPromise === null) {
      sharedSqlJsPromise = initSqlJs(initConfig);
    }
    const SQL = await sharedSqlJsPromise;
    const db = new SQL.Database();
    return new SqlClientImplSqlJs(db);
  }

  connect(): Promise<void> {
    try {
      this.db.exec('SELECT 1');
      return Promise.resolve();
    } catch (err) {
      assert.ok(false, 'Database connection failed', { error: err });
    }
  }

  disconnect(): Promise<void> {
    try {
      this.db.close();
      return Promise.resolve();
    } catch (err) {
      assert.ok(false, 'Database disconnection failed', { error: err });
    }
  }

  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind((params ?? []) as SqlJsBindParams);
      return Promise.resolve(rowsFromStatement(stmt) as T[]);
    } finally {
      stmt.free();
    }
  }

  run(sql: string, params?: unknown[]): Promise<RunResult> {
    this.db.run(sql, (params ?? []) as SqlJsBindParams);
    return Promise.resolve(readRunMeta(this.db));
  }

  prepare(sql: string): PreparedStatement {
    return {
      query: <T = Record<string, unknown>>(params?: unknown[]) => {
        const stmt = this.db.prepare(sql);
        try {
          stmt.bind((params ?? []) as SqlJsBindParams);
          return Promise.resolve(rowsFromStatement(stmt) as T[]);
        } finally {
          stmt.free();
        }
      },
      run: (params?: unknown[]) => {
        const stmt = this.db.prepare(sql);
        try {
          stmt.run((params ?? []) as SqlJsBindParams);
          return Promise.resolve(readRunMeta(this.db));
        } finally {
          stmt.free();
        }
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
