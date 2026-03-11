import { SQL } from 'bun';
import type { RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

type BunSql = InstanceType<typeof SQL>;

export class SqlClientImplBunPostgres implements SqlClient {
  private client: SqlClient;

  constructor(connection: string | URL | BunSql) {
    const sql =
      typeof connection === 'string' || connection instanceof URL
        ? new SQL(connection as string)
        : connection;
    this.client = createClient(sql);
  }

  static connect(connection: string | URL): SqlClientImplBunPostgres {
    return new SqlClientImplBunPostgres(connection);
  }

  connect(): Promise<void> {
    return this.client.connect();
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

  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.client.transaction(fn);
  }
}

function createClient(sql: BunSql): SqlClient {
  return {
    connect: () => Promise.resolve(),
    disconnect: () => sql.close(),
    query: async <T = Record<string, unknown>>(
      querySql: string,
      params?: unknown[]
    ) => {
      const [pgSql, pgParams] = questionMarkParamsToDollarParams(
        querySql,
        params
      );
      const result = await sql.unsafe(pgSql, pgParams);
      return Array.isArray(result) ? (result as T[]) : [];
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
  if (isObjectWithKey(result, 'lastInsertRowid')) {
    const n = result.lastInsertRowid;
    if (typeof n === 'number' && Number.isInteger(n)) return n;
    if (typeof n === 'bigint') return Number(n);
  }
  const first = rows[0];
  if (first != null && isObjectWithKey(first, 'id')) {
    const id = first.id;
    if (typeof id === 'number') return id;
    if (typeof id === 'bigint') return Number(id);
    if (typeof id === 'string') return parseInt(id, 10) || 0;
  }
  return 0;
}
