// @io-wall-ok
/**
 * {@link SqlClient} backed by [pg-mem](https://github.com/oguimbal/pg-mem) —
 * an in-process Postgres emulator for fast unit tests.
 *
 * Prefer this over real TCP Postgres for tests that only need DML + simple
 * DDL. pg-mem does **not** implement PL/pgSQL, hash partitions, or many
 * session GUCs — suites that need those (e.g. `@pkgs/matchmaking` migrate)
 * should keep using {@link createPgliteSqlClient}.
 *
 * Transaction semantics use `IMemoryDb.backup()` / `restore()` because the
 * pg-mem `createPg()` adapter does not persist SQL BEGIN/ROLLBACK state
 * across round-trips.
 */

import type { Sql, Value } from '@pkgs/sql';
import { DataType, type IMemoryDb, newDb } from 'pg-mem';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from '../interface';
import { questionMarkParamsToDollarParams } from '../positional-params';
import {
  type PgExecutor,
  pgQueryRows,
  pgRunResultFromQuery,
} from './impl-pg-shared';
import { installPgMemSqliteCompat } from './pg-mem-sqlite-compat';
import type { Pool } from './pg-types';
import {
  createPostgresDbScope,
  type PostgresDbScope,
  quotePgIdent,
} from './schema';

function pgMemRandomUuid(): string {
  return globalThis.crypto.randomUUID();
}
export type CreatePgMemSqlClientOptions = {
  readonly dbScope?: PostgresDbScope;
  /** Artificial query latency passed to `adapters.createPg` (ms). */
  readonly queryLatencyMs?: number;
};

export type PgMemSqlClientBundle = {
  readonly mem: IMemoryDb;
  readonly sqlClient: PostgresSqlClient;
  /** Same adapter pool Better Auth / migrate use. */
  readonly pool: Pool;
};

function registerPgMemCatalogFns(mem: IMemoryDb): void {
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: pgMemRandomUuid,
    impure: true,
  });
  mem.public.registerOperator({
    operator: '!~',
    left: DataType.text,
    right: DataType.text,
    returns: DataType.bool,
    implementation: (lhs: string, rhs: string) => !new RegExp(rhs).test(lhs),
  });
  mem.public.registerOperator({
    operator: '~',
    left: DataType.text,
    right: DataType.text,
    returns: DataType.bool,
    implementation: (lhs: string, rhs: string) => new RegExp(rhs).test(lhs),
  });
  mem.public.registerFunction({
    name: 'has_schema_privilege',
    args: [DataType.text, DataType.text],
    returns: DataType.bool,
    implementation: () => true,
  });
  mem.public.registerFunction({
    name: 'col_description',
    args: [DataType.integer, DataType.integer],
    returns: DataType.text,
    implementation: () => null,
  });
  mem.public.registerFunction({
    name: 'pg_get_serial_sequence',
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: () => null,
  });
  mem.public.registerFunction({
    name: 'quote_ident',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (ident: string) => `"${String(ident).replace(/"/g, '""')}"`,
  });
  for (const arg of [DataType.integer, DataType.bigint] as const) {
    mem.public.registerFunction({
      name: 'pg_advisory_xact_lock',
      args: [arg],
      returns: DataType.bool,
      implementation: () => true,
      impure: true,
    });
  }
}

function registerPgMemCatalogViews(mem: IMemoryDb): void {
  mem.public.none(`
    CREATE VIEW pg_tables AS
    SELECT
      table_schema AS schemaname,
      table_name AS tablename,
      NULL::text AS tableowner,
      NULL::text AS tablespace,
      NULL::boolean AS hasindexes,
      NULL::boolean AS hasrules,
      NULL::boolean AS hastriggers,
      NULL::boolean AS rowsecurity
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
  `);
  mem.public.none(`
    CREATE VIEW pg_indexes AS
    SELECT
      NULL::text AS schemaname,
      NULL::text AS tablename,
      NULL::text AS indexname,
      NULL::text AS tablespace,
      NULL::text AS indexdef
    WHERE false
  `);
}

function registerPgMemQueryIntercepts(mem: IMemoryDb): void {
  mem.public.interceptQueries((sqlText) => {
    const trimmed = sqlText.trim();
    if (/\bSET\s+STORAGE\b/i.test(trimmed)) return [];
    if (/ALTER\s+TABLE\s+\S+\s+SET\s*\(/i.test(trimmed)) return [];
    if (/ALTER\s+TABLE\s+\S+\s+SET\s+(UN)?LOGGED\b/i.test(trimmed)) {
      return [];
    }
    if (/\brelpersistence\b/i.test(trimmed) && /\bpg_class\b/i.test(trimmed)) {
      return [{ relpersistence: 'u' }];
    }
    if (!/^DO\s+\$\$/i.test(trimmed)) {
      if (/\bUNLOGGED\b/i.test(trimmed) || /\)\s*WITH\s*\(/i.test(trimmed)) {
        const simplified = trimmed
          .replace(/\bUNLOGGED\b/gi, '')
          .replace(/\)\s*WITH\s*\([\s\S]*?\)\s*;?\s*$/i, ');');
        mem.public.none(simplified);
        return [];
      }
      return null;
    }
    for (const statement of extractDoBlockStatements(trimmed)) {
      try {
        mem.public.none(statement);
      } catch {
        // ignore — mirrors EXCEPTION WHEN duplicate_* / undefined_*
      }
    }
    return [];
  });
  mem.registerLanguage('plpgsql', () => () => null);
}

function registerPgMemTestBuiltins(mem: IMemoryDb): void {
  installPgMemSqliteCompat({ mem });
  registerPgMemCatalogFns(mem);
  registerPgMemCatalogViews(mem);
  registerPgMemQueryIntercepts(mem);
}

/** Pull EXECUTE '…' / bare ALTER/CREATE statements out of a DO $$ block. */
function extractDoBlockStatements(doSql: string): string[] {
  const out: string[] = [];
  const executeRe = /EXECUTE\s+'((?:\\'|[^'])*)'/gi;
  for (const match of doSql.matchAll(executeRe)) {
    const sqlText = (match[1] ?? '').replace(/\\'/g, "'").trim();
    if (sqlText.length > 0) out.push(sqlText);
  }
  if (out.length > 0) return out;
  const body = doSql
    .replace(/^DO\s+\$\$\s*BEGIN/i, '')
    .replace(/EXCEPTION[\s\S]*$/i, '')
    .replace(/END\s*\$\$\s*;?\s*$/i, '')
    .trim();
  if (body.length > 0) out.push(body);
  return out;
}

async function execOn(
  executor: PgExecutor,
  sqlText: string,
  params?: readonly unknown[]
) {
  const [text, vals] = questionMarkParamsToDollarParams(sqlText, params);
  if (vals.length > 0) {
    return executor.query(text, vals);
  }
  return executor.query(text);
}

function createPgMemSessionClient(
  mem: IMemoryDb,
  executor: PgExecutor
): SqlClient {
  return {
    connect: async () => {
      /* session owned by outer client */
    },
    disconnect: async () => {
      /* session owned by outer client */
    },
    query: async <T extends Record<string, unknown>>(
      query: Sql<T>
    ): Promise<T[]> => {
      const res = await execOn(executor, query.sql, query.values);
      return pgQueryRows<T>(res);
    },
    run: async (query: Sql<unknown>): Promise<RunResult> => {
      const res = await execOn(executor, query.sql, query.values);
      return pgRunResultFromQuery(res);
    },
    prepare: <T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> => {
      const statementSql = query.sql;
      return {
        query: async (params?: Value[]) => {
          const res = await execOn(executor, statementSql, params);
          return pgQueryRows<T>(res);
        },
        run: async (params?: Value[]) => {
          const res = await execOn(executor, statementSql, params);
          return pgRunResultFromQuery(res);
        },
      };
    },
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> => {
      return runPgMemTransaction(mem, executor, fn);
    },
  };
}

async function runPgMemTransaction<T>(
  mem: IMemoryDb,
  executor: PgExecutor,
  fn: (tx: SqlClient) => Promise<T>
): Promise<T> {
  const backup = mem.backup();
  try {
    return await fn(createPgMemSessionClient(mem, executor));
  } catch (err) {
    try {
      backup.restore();
    } catch {
      // DDL inside the callback bumps schemaVersion — backup cannot restore.
    }
    throw err;
  }
}

/**
 * In-memory Postgres {@link SqlClient}. Pins `dbScope` on the handle for API
 * parity with {@link PostgresSqlClient}; search_path GUCs are best-effort
 * (pg-mem has incomplete session-parameter support).
 */
export class SqlClientImplPgMem implements PostgresSqlClient {
  constructor(
    private readonly mem: IMemoryDb,
    private readonly pool: Pool,
    readonly dbScope: PostgresDbScope
  ) {}

  async connect(): Promise<void> {
    // SET is accepted; assertPgSessionSchema is not (no current_schema()).
    await this.pool.query(
      `SET search_path TO ${quotePgIdent(this.dbScope.schema)}`
    );
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const res = await execOn(this.pool, query.sql, query.values);
    return pgQueryRows<T>(res);
  }

  async run(query: Sql<unknown>): Promise<RunResult> {
    const res = await execOn(this.pool, query.sql, query.values);
    return pgRunResultFromQuery(res);
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const statementSql = query.sql;
    return {
      query: async (params?: Value[]) => {
        const res = await execOn(this.pool, statementSql, params);
        return pgQueryRows<T>(res);
      },
      run: async (params?: Value[]) => {
        const res = await execOn(this.pool, statementSql, params);
        return pgRunResultFromQuery(res);
      },
    };
  }

  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return runPgMemTransaction(this.mem, this.pool, fn);
  }
}

/**
 * Mints a fresh in-memory Postgres and a {@link PostgresSqlClient} over it.
 * Call `sqlClient.disconnect()` when the test is done (ends the mem pool).
 */
export function createPgMemSqlClient(
  options?: CreatePgMemSqlClientOptions
): PgMemSqlClientBundle {
  const dbScope = options?.dbScope ?? createPostgresDbScope('public');
  const mem = newDb();
  registerPgMemTestBuiltins(mem);
  const { Pool: MemPool } = mem.adapters.createPg(options?.queryLatencyMs);
  const pool = new MemPool() as Pool;
  const sqlClient = new SqlClientImplPgMem(mem, pool, dbScope);
  return { mem, sqlClient, pool };
}
