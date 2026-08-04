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

import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { DataType, newDb, type IMemoryDb } from 'pg-mem';
import type { Sql, Value } from '@pkgs/sql';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from '../interface';
import { questionMarkParamsToDollarParams } from '../positional-params';
import {
  pgQueryRows,
  pgRunResultFromQuery,
  type PgExecutor,
} from './impl-pg-shared';
import {
  createPostgresDbScope,
  quotePgIdent,
  type PostgresDbScope,
} from './schema';

export type CreatePgMemSqlClientOptions = {
  readonly dbScope?: PostgresDbScope;
  /** Artificial query latency passed to `adapters.createPg` (ms). */
  readonly queryLatencyMs?: number;
};

export type PgMemSqlClientBundle = {
  readonly mem: IMemoryDb;
  readonly sqlClient: PostgresSqlClient;
};

function registerPgMemTestBuiltins(mem: IMemoryDb): void {
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: randomUUID,
    impure: true,
  });
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
    backup.restore();
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
  return { mem, sqlClient };
}
