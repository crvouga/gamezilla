import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { bigintToJsonSafe } from '@pkgs/sql-client-postgres-shared-ts/normalize-pg-int8';
import { sanitizePostgresUrlForBunSql } from '@pkgs/sql-client-postgres-shared-ts/sanitize-url-for-bun-sql';
import {
  postgresRejectsStartupSearchPathOption,
  sqlBundledWithSearchPath,
} from '@pkgs/sql-client-postgres-shared-ts/session-schema';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import { questionMarkParamsToDollarParams } from '@pkgs/sql-client-root-shared-ts/positional-params';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { quotePgIdent } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import type { Sql, Value } from '@pkgs/sql-root-shared-ts/sql';
import { SQL } from 'bun';

type BunSql = InstanceType<typeof SQL>;

type BunClientOptions = {
  readonly pinSearchPathEachQuery: boolean;
  readonly dbScope: PostgresDbScope;
};

export class SqlClientImplBunPostgres implements PostgresSqlClient {
  private client: SqlClient;

  constructor(
    connection: string | URL | BunSql,
    readonly dbScope: PostgresDbScope
  ) {
    const sql =
      typeof connection === 'string' || connection instanceof URL
        ? new SQL(
            sanitizePostgresUrlForBunSql(connection),
            startupOptions(connection, dbScope)
          )
        : connection;
    // Bun does not apply every libpq startup option, and a server that resolves
    // names while a transaction block is still setting its path can describe a
    // query's rows against the old path. The startup parameter below gives each
    // connection the schema before its first query; a transaction still pins the
    // same backend that executes the query, including behind poolers.
    this.client = createClient(sql, { pinSearchPathEachQuery: true, dbScope });
  }

  static connect(
    connection: string | URL,
    dbScope: PostgresDbScope
  ): SqlClientImplBunPostgres {
    return new SqlClientImplBunPostgres(connection, dbScope);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    return this.client.query(query);
  }

  run(query: Sql<unknown>): Promise<RunResult> {
    return this.client.run(query);
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    return this.client.prepare(query);
  }

  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.client.transaction(fn);
  }
}

/**
 * Sends `search_path` as a startup parameter by name, which Bun applies where
 * it ignores the URL's `options`. Pooler endpoints reject startup parameters,
 * so they rely on the per-query pin alone.
 */
function startupOptions(
  connection: string | URL,
  dbScope: PostgresDbScope
): { readonly connection?: Record<string, string> } {
  if (postgresRejectsStartupSearchPathOption(String(connection))) return {};
  return { connection: { search_path: dbScope.schema } };
}

type BunPinnedQueryArgs = {
  readonly sql: BunSql;
  readonly options: BunClientOptions;
  readonly querySql: string;
  readonly params?: readonly unknown[] | undefined;
  /** Bundled SET+SQL is run-only; queries need BEGIN/SET LOCAL for row results. */
  readonly mode: 'query' | 'run';
};

async function withBunSearchPathPin<T>(
  args: BunPinnedQueryArgs,
  fn: (conn: BunSql, text: string, vals: unknown[]) => Promise<T>
): Promise<T> {
  const { sql, options, querySql, params, mode } = args;
  const [text, vals] = questionMarkParamsToDollarParams(querySql, params);
  if (!options.pinSearchPathEachQuery) {
    return fn(sql, text, vals);
  }
  if (vals.length === 0 && mode === 'run') {
    return fn(sql, sqlBundledWithSearchPath(options.dbScope, text), vals);
  }
  return sql.begin(async (tx) => {
    const conn = tx as unknown as BunSql;
    await conn.unsafe(
      `SET LOCAL search_path TO ${quotePgIdent(options.dbScope.schema)}`
    );
    return fn(conn, text, vals);
  });
}

async function bunQueryRows<T>(
  conn: BunSql,
  pgSql: string,
  pgParams: unknown[]
): Promise<T[]> {
  const result = await conn.unsafe(pgSql, pgParams);
  assert.array(
    result,
    'Postgres query must return array of rows; driver contract violation'
  );
  return result as T[];
}

async function bunRunStatement(
  conn: BunSql,
  pgSql: string,
  pgParams: unknown[]
): Promise<RunResult> {
  const result = await conn.unsafe(pgSql, pgParams);
  const rows = Array.isArray(result) ? result : [];
  return {
    changes: getChanges(result, rows),
    lastInsertRowid: getLastInsertRowid(result, rows),
  };
}

function createClient(sql: BunSql, options: BunClientOptions): SqlClient {
  const unpinned = { ...options, pinSearchPathEachQuery: false };
  return {
    connect: () => Promise.resolve(),
    // Bounded timeout: Bun's `sql.close()` with no argument waits for all
    // pooled queries to drain, which can keep the event loop alive on CI
    // and hang the process after work completes. 5s is plenty for an idle
    // pool; anything longer indicates stuck handles we would kill anyway.
    disconnect: () => sql.close({ timeout: 5 }),
    prepare: <T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> => {
      const querySql = query.sql;
      return {
        query: async (params?: Value[]) =>
          withBunSearchPathPin(
            { sql, options, querySql, params, mode: 'query' },
            (conn, text, vals) => bunQueryRows<T>(conn, text, vals)
          ),
        run: async (params?: Value[]) =>
          withBunSearchPathPin(
            { sql, options, querySql, params, mode: 'run' },
            (conn, text, vals) => bunRunStatement(conn, text, vals)
          ),
      };
    },
    query: async <T extends Record<string, unknown>>(query: Sql<T>) =>
      withBunSearchPathPin(
        {
          sql,
          options,
          querySql: query.sql,
          params: query.values,
          mode: 'query',
        },
        (conn, text, vals) => bunQueryRows<T>(conn, text, vals)
      ),
    run: async (query: Sql<unknown>) =>
      withBunSearchPathPin(
        {
          sql,
          options,
          querySql: query.sql,
          params: query.values,
          mode: 'run',
        },
        (conn, text, vals) => bunRunStatement(conn, text, vals)
      ),
    transaction: async (fn) =>
      sql.begin(async (tx) => {
        const conn = tx as unknown as BunSql;
        await conn.unsafe('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        if (options.pinSearchPathEachQuery) {
          await conn.unsafe(
            `SET LOCAL search_path TO ${quotePgIdent(options.dbScope.schema)}`
          );
        }
        return fn(createClient(conn, unpinned));
      }),
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
  if (typeof value === 'bigint') {
    const n = bigintToJsonSafe(value);
    return typeof n === 'number' ? n : 0;
  }
  if (typeof value === 'string') return parseInt(value, 10) || 0;
  return undefined;
}
