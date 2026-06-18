import { SQL } from 'bun';
import { assert } from '@pkgs/assert';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from './interface';
import type { PostgresDbScope } from './postgres-schema';
import { quotePgIdent } from './postgres-schema';
import {
  postgresRejectsStartupSearchPathOption,
  withPostgresSearchPathOption,
} from './postgres-session-schema';
import { questionMarkParamsToDollarParams } from './positional-params';
import { sanitizePostgresUrlForBunSql } from './sanitize-postgres-url-for-bun-sql';

type BunSql = InstanceType<typeof SQL>;

export class SqlClientImplBunPostgres implements PostgresSqlClient {
  private client: SqlClient;
  private readonly needsSessionSearchPath: boolean;

  constructor(
    connection: string | URL | BunSql,
    readonly dbScope: PostgresDbScope
  ) {
    const needsSessionSearchPath =
      typeof connection === 'string'
        ? postgresRejectsStartupSearchPathOption(connection)
        : connection instanceof URL
          ? postgresRejectsStartupSearchPathOption(connection.toString())
          : false;
    this.needsSessionSearchPath = needsSessionSearchPath;
    const sql =
      typeof connection === 'string' || connection instanceof URL
        ? new SQL(
            withPostgresSearchPathOption(
              sanitizePostgresUrlForBunSql(connection),
              dbScope
            )
          )
        : connection;
    this.client = createClient(sql);
  }

  static connect(
    connection: string | URL,
    dbScope: PostgresDbScope
  ): SqlClientImplBunPostgres {
    return new SqlClientImplBunPostgres(connection, dbScope);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    if (this.needsSessionSearchPath) {
      await this.client.run(
        `SET search_path TO ${quotePgIdent(this.dbScope.schema)}`
      );
    }
  }

  disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    return this.client.query<T>(sql, params);
  }

  run(sql: string, params?: unknown[]): Promise<RunResult> {
    return this.client.run(sql, params);
  }

  prepare(sql: string): PreparedStatement {
    return this.client.prepare(sql);
  }

  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.client.transaction(fn);
  }
}

function createClient(sql: BunSql): SqlClient {
  return {
    connect: () => Promise.resolve(),
    // Bounded timeout: Bun's `sql.close()` with no argument waits for all
    // pooled queries to drain, which can keep the event loop alive on CI
    // and hang the process after work completes. 5s is plenty for an idle
    // pool; anything longer indicates stuck handles we would kill anyway.
    disconnect: () => sql.close({ timeout: 5 }),
    prepare: (querySql: string): PreparedStatement => ({
      query: async <T = Record<string, unknown>>(params?: unknown[]) => {
        const [pgSql, pgParams] = questionMarkParamsToDollarParams(
          querySql,
          params
        );
        const result = await sql.unsafe(pgSql, pgParams);
        assert.array(
          result,
          'Postgres query must return array of rows; driver contract violation'
        );
        return result as T[];
      },
      run: async (params?: unknown[]) => {
        const [pgSql, pgParams] = questionMarkParamsToDollarParams(
          querySql,
          params
        );
        const result = await sql.unsafe(pgSql, pgParams);
        const rows = Array.isArray(result) ? result : [];
        return {
          changes: getChanges(result, rows),
          lastInsertRowid: getLastInsertRowid(result, rows),
        };
      },
    }),
    query: async <T = Record<string, unknown>>(
      querySql: string,
      params?: unknown[]
    ) => {
      const [pgSql, pgParams] = questionMarkParamsToDollarParams(
        querySql,
        params
      );
      const result = await sql.unsafe(pgSql, pgParams);
      assert.array(
        result,
        'Postgres query must return array of rows; driver contract violation'
      );
      return result as T[];
    },
    run: async (querySql: string, params?: unknown[]) => {
      const [pgSql, pgParams] = questionMarkParamsToDollarParams(
        querySql,
        params
      );
      const result = await sql.unsafe(pgSql, pgParams);
      const rows = Array.isArray(result) ? result : [];
      const changes = getChanges(result, rows);
      const lastInsertRowid = getLastInsertRowid(result, rows);
      return { changes, lastInsertRowid };
    },
    transaction: async (fn) => {
      return sql.begin(async (tx) => {
        // Bun sql.begin callback receives a tx compatible with BunSql.
        const txClient = createClient(tx as unknown as BunSql);
        return fn(txClient);
      });
    },
  };
}

function isObjectWithKey<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return obj !== null && typeof obj === 'object' && key in obj;
}

function getChanges(result: unknown, rows: unknown[]): number {
  if (isObjectWithKey(result, 'affectedRows')) {
    const n = result.affectedRows;
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0) return n;
  }
  if (isObjectWithKey(result, 'rowCount')) {
    const n = result.rowCount;
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0) return n;
  }
  return rows.length;
}

function getLastInsertRowid(result: unknown, rows: unknown[]): number {
  const fromResult = readLastInsertRowid(result);
  if (fromResult !== undefined) return fromResult;
  return readIdFromFirstRow(rows[0]);
}

function readLastInsertRowid(result: unknown): number | undefined {
  if (!isObjectWithKey(result, 'lastInsertRowid')) return undefined;
  return coerceToNumber(result.lastInsertRowid);
}

function readIdFromFirstRow(first: unknown): number {
  if (first === null || first === undefined) return 0;
  if (!isObjectWithKey(first, 'id')) return 0;
  return coerceToNumber(first.id) ?? 0;
}

function coerceToNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return parseInt(value, 10) || 0;
  return undefined;
}
