/**
 * In-memory {@link SqlClient} backed by `@crvouga/mockingbird-service-sqlite`.
 *
 * Browser product harnesses use this instead of the web OPFS SQLite. Snapshots are
 * mockingbird-sqlite SQLM blobs wrapped with `PRAGMA user_version` (not encoded in SQLM).
 */

import { Database, Snapshot } from '@crvouga/mockingbird-service-sqlite';
import { assert } from '@pkgs/assert-shared/singleton';
import type { Sql, Value } from '@pkgs/sql-shared/sql';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-shared/interface';
import { applySqliteConnectionPragmas } from './connection-pragmas';

const SQLM_MAGIC0 = 0x53;
const SQLM_MAGIC1 = 0x51;
const SQLM_MAGIC2 = 0x4c;
const SQLM_MAGIC3 = 0x4d;

const SNAPSHOT_KIND = 'mockingbird-sqlite';

type MockingbirdSqliteBind =
  | string
  | number
  | boolean
  | bigint
  | null
  | Uint8Array
  | ArrayBuffer;

export type MockingbirdSqliteOpenOptions = {
  readonly now?: () => Date;
  readonly seed?: number;
};

function toBinds(values: readonly Value[]): MockingbirdSqliteBind[] {
  return values.map((v) =>
    v === undefined ? null : (v as MockingbirdSqliteBind)
  );
}

function toRunResult(result: {
  changes: number;
  lastInsertRowid: number | bigint;
}): RunResult {
  return {
    changes: result.changes,
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

function hasSqlmMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === SQLM_MAGIC0 &&
    bytes[1] === SQLM_MAGIC1 &&
    bytes[2] === SQLM_MAGIC2 &&
    bytes[3] === SQLM_MAGIC3
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function readUserVersion(db: Database): number {
  const rows = db.query<{ user_version: number }>('PRAGMA user_version');
  return rows[0]?.user_version ?? 0;
}

/** mockingbird-sqlite does not yet parse `IS TRUE` / `IS FALSE` (column name TRUE). */
function adaptSql(sqlText: string): string {
  return sqlText
    .replace(/\bIS\s+NOT\s+TRUE\b/gi, '!= 1')
    .replace(/\bIS\s+NOT\s+FALSE\b/gi, '!= 0')
    .replace(/\bIS\s+TRUE\b/gi, '= 1')
    .replace(/\bIS\s+FALSE\b/gi, '= 0');
}

/**
 * STRICT / PRIMARY KEY columns are NOT NULL in SQLite `table_info`.
 * mockingbird-sqlite currently reports `notnull: 0` for TEXT PRIMARY KEY.
 */
function patchTableInfoRows<T extends Record<string, unknown>>(
  sqlText: string,
  rows: T[]
): T[] {
  if (!/^\s*PRAGMA\s+table_info\b/i.test(sqlText)) return rows;
  return rows.map((row) => {
    const pk = row['pk'];
    if (typeof pk === 'number' && pk > 0) {
      return { ...row, notnull: 1 };
    }
    return row;
  });
}

function parseSnapshotPayload(bytes: Uint8Array): {
  userVersion: number;
  sqlm: Uint8Array;
} {
  let payload: {
    v?: unknown;
    kind?: unknown;
    userVersion?: unknown;
    sqlmB64?: unknown;
  };
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes)) as typeof payload;
  } catch {
    throw new Error(
      'SqlClientImplMockingbirdSqlite.importDatabaseBytes: expected JSON mockingbird-sqlite snapshot'
    );
  }
  if (
    payload.v !== 1 ||
    payload.kind !== SNAPSHOT_KIND ||
    typeof payload.userVersion !== 'number' ||
    !Number.isInteger(payload.userVersion) ||
    typeof payload.sqlmB64 !== 'string'
  ) {
    throw new Error(
      'SqlClientImplMockingbirdSqlite.importDatabaseBytes: unsupported snapshot format'
    );
  }
  const sqlm = base64ToBytes(payload.sqlmB64);
  assert.ok(
    hasSqlmMagic(sqlm),
    'SqlClientImplMockingbirdSqlite.importDatabaseBytes: missing SQLM magic'
  );
  return { userVersion: payload.userVersion, sqlm };
}

function applyImportedMockingbirdSqlitePragmas(
  db: Database,
  userVersion: number
): void {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA journal_mode = MEMORY');
  db.exec('PRAGMA temp_store = MEMORY');
  db.prepare('PRAGMA user_version = ?').run(userVersion);
}

import { createTransactionChain } from './transaction-chain';

export class SqlClientImplMockingbirdSqlite implements SqlClient {
  private db: Database | null;
  private readonly openOptions: MockingbirdSqliteOpenOptions | undefined;
  private readonly enqueueTxn = createTransactionChain();

  private constructor(
    db: Database,
    openOptions?: MockingbirdSqliteOpenOptions
  ) {
    this.db = db;
    this.openOptions = openOptions;
  }

  static open(
    options?: MockingbirdSqliteOpenOptions
  ): SqlClientImplMockingbirdSqlite {
    return new SqlClientImplMockingbirdSqlite(new Database(options), options);
  }

  private requireDb(): Database {
    assert.ok(
      this.db != null,
      'SqlClientImplMockingbirdSqlite: database is closed'
    );
    return this.db;
  }

  async connect(): Promise<void> {
    try {
      this.requireDb().query('SELECT 1');
      await applySqliteConnectionPragmas(this);
    } catch (err) {
      assert.ok(false, 'Database connection failed', { error: err });
    }
  }

  disconnect(): Promise<void> {
    if (this.db == null) return Promise.resolve();
    try {
      this.db.close();
      return Promise.resolve();
    } catch (err) {
      assert.ok(false, 'Database disconnection failed', { error: err });
    } finally {
      this.db = null;
    }
  }

  /**
   * JSON envelope around a SQLM snapshot plus `PRAGMA user_version`.
   */
  exportDatabaseBytes(): Uint8Array {
    const db = this.requireDb();
    const payload = {
      v: 1 as const,
      kind: SNAPSHOT_KIND,
      userVersion: readUserVersion(db),
      sqlmB64: bytesToBase64(db.snapshot().encode()),
    };
    return new TextEncoder().encode(JSON.stringify(payload));
  }

  /**
   * Restore a prior {@link exportDatabaseBytes} payload into this connection.
   */
  importDatabaseBytes(bytes: Uint8Array): void {
    const { userVersion, sqlm } = parseSnapshotPayload(bytes);
    const next = Snapshot.decode(sqlm).open(this.openOptions);
    const prev = this.requireDb();
    this.db = next;
    prev.close();
    applyImportedMockingbirdSqlitePragmas(next, userVersion);
  }

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const sqlText = adaptSql(query.sql);
    const rows = this.requireDb().query<T>(sqlText, toBinds(query.values));
    return Promise.resolve(patchTableInfoRows(sqlText, rows));
  }

  run(query: Sql<unknown>): Promise<RunResult> {
    const result = this.requireDb()
      .prepare(adaptSql(query.sql))
      .run(...toBinds(query.values));
    return Promise.resolve(toRunResult(result));
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const sqlText = adaptSql(query.sql);
    const stmt = this.requireDb().prepare(sqlText);
    return {
      query: (params?: Value[]) => {
        const rows = stmt.all<T>(...toBinds(params ?? []));
        return Promise.resolve(patchTableInfoRows(sqlText, rows));
      },
      run: (params?: Value[]) => {
        return Promise.resolve(toRunResult(stmt.run(...toBinds(params ?? []))));
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.enqueueTxn(() => this.execTransaction(fn));
  }

  private async execTransaction<T>(
    fn: (tx: SqlClient) => Promise<T>
  ): Promise<T> {
    const db = this.requireDb();
    db.exec('BEGIN');
    try {
      const result = await fn(this);
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}
