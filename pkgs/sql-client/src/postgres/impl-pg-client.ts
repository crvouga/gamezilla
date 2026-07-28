/**
 * {@link SqlClient} over a single {@link Client} (one TCP session). For
 * Cloudflare Workers (TCP via nodejs_compat): construct per request; do not share
 * across requests.
 */
import type { Client } from 'pg';
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
} from '../interface';
import type { PostgresDbScope } from './schema';
import {
  assertPgSessionSchema,
  setPgSessionSchema,
} from './session-schema';

export class SqlClientImplPgClient implements PostgresSqlClient {
  constructor(
    private readonly client: Client,
    readonly dbScope: PostgresDbScope,
    private readonly pinSearchPathEachQuery = false
  ) {}

  async connect(): Promise<void> {
    await assertPgSessionSchema(this.client, this.dbScope);
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  private pgQuery(sql: string, params?: unknown[]) {
    return pgQueryWithOptionalSearchPathPin({
      queryable: this.client,
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
    try {
      await this.client.query('BEGIN');
      if (this.pinSearchPathEachQuery) {
        await setPgSessionSchema(this.client, this.dbScope);
      }
      const txSql = createPgSessionClient(this.client);
      const out = await fn(txSql);
      await this.client.query('COMMIT');
      return out;
    } catch (err) {
      await this.client.query('ROLLBACK');
      throw err;
    }
  }
}
