/**
 * {@link SqlClient} backed by `@crvouga/postgres-mem` — pure TypeScript
 * in-memory PostgreSQL for hermetic sim / playground server DBs.
 *
 * Prefer this over sqlite-mem for the **server** half of product sims so
 * dialect matches production Postgres. Clients stay on sqlite-mem.
 *
 * Snapshots are PGMM blobs wrapped in a JSON envelope (not `pg_dump`).
 */

import { Database, Snapshot } from '@crvouga/postgres-mem';
import { assert } from '@pkgs/assert';
import { installPostgresMemSqliteCompat } from '@pkgs/postgres-sqlite-compat/install-postgres-mem';
import type { Sql, Value } from '@pkgs/sql';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from '../interface';
import { questionMarkParamsToDollarParams } from '../positional-params';
import { readLastInsertRowid } from './impl-pg-shared';
import { normalizePgInt8Rows } from './normalize-pg-int8';
import type { Pool, PoolClient, QueryResult } from './pg-types';
import {
  encodePostgresMemSnapshotEnvelope,
  parsePostgresMemSnapshotEnvelope,
} from './postgres-mem-snapshot';
import { repairPostgresMemPgmmBigintSlots } from './repair-pgmm-bigint-slots';
import {
  createPostgresDbScope,
  type PostgresDbScope,
  quotePgIdent,
} from './schema';

type PostgresMemBind =
  | string
  | number
  | boolean
  | bigint
  | null
  | Uint8Array
  | Date;

export type PostgresMemOpenOptions = {
  readonly now?: () => Date;
  readonly seed?: number | bigint;
  readonly dbScope?: PostgresDbScope;
  /** When false, skip JSON1 LANGUAGE sql shims (tests). Default true. */
  readonly installSqliteCompat?: boolean;
};

export type PostgresMemSqlClientBundle = {
  readonly db: Database;
  readonly sqlClient: SqlClientImplPostgresMem;
  /** Pool-shaped facade for Better Auth / Kysely migrate. */
  readonly pool: Pool;
};

function toBinds(values: readonly Value[]): PostgresMemBind[] {
  return values.map((v) => {
    if (v === undefined) return null;
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      typeof v === 'bigint' ||
      v === null ||
      v instanceof Uint8Array ||
      v instanceof Date
    ) {
      return v;
    }
    // Objects / arrays → JSON text (Postgres text/jsonb bind surface).
    return JSON.stringify(v);
  });
}

function execOnDb(
  db: Database,
  sqlText: string,
  params?: readonly Value[]
): { rows: Record<string, unknown>[]; rowCount: number } {
  const [text, vals] = questionMarkParamsToDollarParams(sqlText, params);
  const trimmed = text.trim();
  if (/^DO\s+\$\$/i.test(trimmed)) {
    return execDoBlock(db, trimmed);
  }
  const noop = tryPostgresMemNoop(trimmed, db, vals as Value[]);
  if (noop !== null) return noop;
  const isSelect =
    /^\s*(select|with|show|values)\b/i.test(trimmed) ||
    /\breturning\b/i.test(trimmed);
  if (isSelect) {
    const rows = db.query<Record<string, unknown>>(
      text,
      toBinds(vals as Value[])
    );
    return { rows: normalizePgInt8Rows(rows), rowCount: rows.length };
  }
  if (vals.length === 0 && /;\s*\S/.test(trimmed)) {
    // Multi-statement DDL scripts (no binds) — postgres-mem `exec`.
    db.exec(text);
    return { rows: [], rowCount: db.changes };
  }
  const result = db.prepare(text).run(...toBinds(vals as Value[]));
  return { rows: [], rowCount: result.rowCount };
}

/**
 * Storage / UNLOGGED tweaks are real-Postgres only. Mirror postgres-mem intercepts so
 * package migrates succeed on the dialect emulator.
 */
function tryPostgresMemNoop(
  trimmed: string,
  db: Database,
  vals: readonly Value[]
): { rows: Record<string, unknown>[]; rowCount: number } | null {
  if (/\bSET\s+STORAGE\b/i.test(trimmed)) {
    return { rows: [], rowCount: 0 };
  }
  if (/ALTER\s+TABLE\s+\S+\s+SET\s*\(/i.test(trimmed)) {
    return { rows: [], rowCount: 0 };
  }
  if (/ALTER\s+TABLE\s+\S+\s+SET\s+(UN)?LOGGED\b/i.test(trimmed)) {
    return { rows: [], rowCount: 0 };
  }
  if (/\brelpersistence\b/i.test(trimmed) && /\bpg_class\b/i.test(trimmed)) {
    // Pretend already UNLOGGED so migrate skips SET UNLOGGED.
    return { rows: [{ relpersistence: 'u' }], rowCount: 1 };
  }
  if (/\bUNLOGGED\b/i.test(trimmed) && /^\s*CREATE\s+TABLE\b/i.test(trimmed)) {
    const simplified = trimmed.replace(/\bUNLOGGED\b/gi, '');
    db.prepare(simplified).run(...toBinds(vals));
    return { rows: [], rowCount: db.changes };
  }
  return null;
}

/**
 * postgres-mem rejects PL/pgSQL `DO` blocks. Expand the known migrate DO that
 * drops engine defaults on id/created_at/updated_at into plain ALTER statements.
 */
function execDoBlock(
  db: Database,
  doSql: string
): { rows: Record<string, unknown>[]; rowCount: number } {
  if (
    /DROP DEFAULT/i.test(doSql) &&
    /information_schema\.columns/i.test(doSql) &&
    /created_at/i.test(doSql)
  ) {
    const rows = db.query<{ table_name: string; column_name: string }>(`
      SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = current_schema()
        AND c.column_name IN ('id', 'created_at', 'updated_at')
        AND c.column_default IS NOT NULL
    `);
    let changes = 0;
    for (const row of rows) {
      const table = quotePgIdent(row.table_name);
      const column = quotePgIdent(row.column_name);
      db.exec(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT`);
      changes += 1;
    }
    return { rows: [], rowCount: changes };
  }
  throw new Error(
    `SqlClientImplPostgresMem: unsupported DO $$ block (PL/pgSQL). Rewrite as plain SQL or expand in the adapter.\n${doSql.slice(0, 200)}`
  );
}

function createSessionClient(db: Database): SqlClient {
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query: async <T extends Record<string, unknown>>(
      query: Sql<T>
    ): Promise<T[]> => {
      const { rows } = execOnDb(db, query.sql, query.values);
      return rows as T[];
    },
    run: async (query: Sql<unknown>): Promise<RunResult> => {
      const { rows, rowCount } = execOnDb(db, query.sql, query.values);
      return {
        changes: rowCount || db.changes,
        lastInsertRowid: readLastInsertRowid(rows),
      };
    },
    prepare: <T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> => {
      const statementSql = query.sql;
      return {
        query: async (params?: Value[]) => {
          const { rows } = execOnDb(db, statementSql, params);
          return rows as T[];
        },
        run: async (params?: Value[]) => {
          const { rows, rowCount } = execOnDb(db, statementSql, params);
          return {
            changes: rowCount || db.changes,
            lastInsertRowid: readLastInsertRowid(rows),
          };
        },
      };
    },
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> => {
      db.exec('BEGIN');
      try {
        const result = await fn(createSessionClient(db));
        db.exec('COMMIT');
        return result;
      } catch (e) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // already aborted / closed
        }
        throw e;
      }
    },
  };
}

/**
 * Minimal `pg.Pool` facade over a single postgres-mem {@link Database}.
 * Enough for Better Auth Kysely migrate (`pool.query` / `pool.connect`).
 */
export function adaptPostgresMemAsPool(getDb: () => Database): Pool {
  const runQuery = (text: string, values?: unknown[]): Promise<QueryResult> => {
    try {
      const { rows, rowCount } = execOnDb(
        getDb(),
        text,
        (values ?? []) as Value[]
      );
      return Promise.resolve({ rows, rowCount });
    } catch (err) {
      return Promise.reject(err);
    }
  };

  const checkoutClient = (): PoolClient => {
    return {
      query: ((text: string, values?: unknown[]) =>
        runQuery(text, values)) as PoolClient['query'],
      release: () => undefined,
    };
  };

  let ended = false;
  const poolAdapter = {
    connect: (
      callback?: (
        err: Error | undefined,
        client: PoolClient | undefined,
        done: (release?: boolean | (() => void)) => void
      ) => void
    ) => {
      if (typeof callback === 'function') {
        callback(undefined, checkoutClient(), () => undefined);
        return undefined;
      }
      return Promise.resolve(checkoutClient());
    },
    query: (
      text: string,
      values?: unknown[],
      callback?: (err: Error | undefined, result: unknown) => void
    ) => {
      const run = runQuery(text, values);
      if (typeof callback === 'function') {
        void run
          .then((result) => callback(undefined, result))
          .catch((err: unknown) => {
            callback(
              err instanceof Error ? err : new Error(String(err)),
              undefined
            );
          });
        return undefined;
      }
      return run;
    },
    end: async () => {
      ended = true;
    },
    on: () => poolAdapter,
    totalCount: 1,
    idleCount: ended ? 0 : 1,
    waitingCount: 0,
  };
  return poolAdapter as unknown as Pool;
}

function postgresMemEngineOptions(options?: PostgresMemOpenOptions) {
  return {
    seed: options?.seed ?? 1,
    ...(options?.now !== undefined ? { now: options.now } : {}),
  };
}

export class SqlClientImplPostgresMem implements PostgresSqlClient {
  private db: Database | null;

  private constructor(
    db: Database,
    readonly dbScope: PostgresDbScope,
    private readonly openOptions: PostgresMemOpenOptions | undefined
  ) {
    this.db = db;
  }

  static open(options?: PostgresMemOpenOptions): SqlClientImplPostgresMem {
    const dbScope = options?.dbScope ?? createPostgresDbScope('public');
    const db = new Database(postgresMemEngineOptions(options));
    if (options?.installSqliteCompat !== false) {
      installPostgresMemSqliteCompat({ db });
    }
    return new SqlClientImplPostgresMem(db, dbScope, options);
  }

  private requireDb(): Database {
    assert.ok(this.db != null, 'SqlClientImplPostgresMem: database is closed');
    return this.db;
  }

  /** Underlying engine — for Pool adapt / compat install. */
  get rawDb(): Database {
    return this.requireDb();
  }

  async connect(): Promise<void> {
    try {
      this.requireDb().query('SELECT 1');
      if (this.dbScope.schema !== 'public') {
        this.requireDb().exec(
          `SET search_path TO ${quotePgIdent(this.dbScope.schema)}`
        );
      }
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

  exportDatabaseBytes(): Uint8Array {
    return encodePostgresMemSnapshotEnvelope(
      this.requireDb().snapshot().encode()
    );
  }

  importDatabaseBytes(bytes: Uint8Array): void {
    const pgmm = parsePostgresMemSnapshotEnvelope(bytes);
    const next = Snapshot.decode(pgmm).open(
      postgresMemEngineOptions(this.openOptions)
    );
    repairPostgresMemPgmmBigintSlots(next);
    const prev = this.requireDb();
    this.db = next;
    prev.close();
    if (this.dbScope.schema !== 'public') {
      next.exec(`SET search_path TO ${quotePgIdent(this.dbScope.schema)}`);
    }
  }

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const { rows } = execOnDb(this.requireDb(), query.sql, query.values);
    return Promise.resolve(rows as T[]);
  }

  run(query: Sql<unknown>): Promise<RunResult> {
    const db = this.requireDb();
    const { rows, rowCount } = execOnDb(db, query.sql, query.values);
    return Promise.resolve({
      changes: rowCount || db.changes,
      lastInsertRowid: readLastInsertRowid(rows),
    });
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const statementSql = query.sql;
    const db = this.requireDb();
    return {
      query: (params?: Value[]) => {
        const { rows } = execOnDb(db, statementSql, params);
        return Promise.resolve(rows as T[]);
      },
      run: (params?: Value[]) => {
        const { rows, rowCount } = execOnDb(db, statementSql, params);
        return Promise.resolve({
          changes: rowCount || db.changes,
          lastInsertRowid: readLastInsertRowid(rows),
        });
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    const db = this.requireDb();
    db.exec('BEGIN');
    try {
      const result = await fn(createSessionClient(db));
      db.exec('COMMIT');
      return result;
    } catch (e) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw e;
    }
  }
}

/**
 * Mints a fresh in-memory Postgres and a {@link SqlClientImplPostgresMem} over it.
 * Call `sqlClient.disconnect()` when done.
 */
export function createPostgresMemSqlClient(
  options?: PostgresMemOpenOptions
): PostgresMemSqlClientBundle {
  const sqlClient = SqlClientImplPostgresMem.open(options);
  const pool = adaptPostgresMemAsPool(() => sqlClient.rawDb);
  return { db: sqlClient.rawDb, sqlClient, pool };
}
