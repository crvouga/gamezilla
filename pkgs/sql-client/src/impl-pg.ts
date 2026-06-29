/**
 * {@link SqlClient} backed by a `node-postgres` {@link Pool}.
 *
 * Works in Bun/Node and in Cloudflare Workers with `nodejs_compat` (TCP to
 * Postgres). Uses real `BEGIN`/`COMMIT` in {@link SqlClient#transaction}.
 *
 * For per-request TCP clients (one client per request, no module-scope pool),
 * prefer `SqlClientImplPgClient` from `./impl-pg-client`.
 */
import type { Pool } from 'pg';
import {
  createPgSessionClient,
  pgQueryRows,
  pgQueryWithOptionalSearchPathPin,
  pgRunResultFromQuery,
} from './impl-pg-shared';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from './interface';
import type { PostgresDbScope } from './postgres-schema';
import {
  assertPgSessionSchema,
  setPgSessionSchema,
} from './postgres-session-schema';

export { SqlClientImplPgClient } from './impl-pg-client';

export class SqlClientImplPg implements PostgresSqlClient {
  constructor(
    private readonly pool: Pool,
    readonly dbScope: PostgresDbScope,
    private readonly pinSearchPathEachQuery = false
  ) {}

  async connect(): Promise<void> {
    await assertPgSessionSchema(this.pool, this.dbScope);
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  private pgQuery(sql: string, params?: unknown[]) {
    return pgQueryWithOptionalSearchPathPin({
      queryable: this.pool,
      dbScope: this.dbScope,
      pinSearchPathEachQuery: this.pinSearchPathEachQuery,
      sql,
      params,
    });
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const res = await this.pgQuery(sql, params);
    return pgQueryRows<T>(res);
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const res = await this.pgQuery(sql, params);
    return pgRunResultFromQuery(res);
  }

  prepare(sql: string): PreparedStatement {
    return {
      query: <T = Record<string, unknown>>(params?: unknown[]) =>
        this.query<T>(sql, params),
      run: (params?: unknown[]) => this.run(sql, params),
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (this.pinSearchPathEachQuery) {
        await setPgSessionSchema(client, this.dbScope);
      }
      const txSql = createPgSessionClient(client);
      const out = await fn(txSql);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
