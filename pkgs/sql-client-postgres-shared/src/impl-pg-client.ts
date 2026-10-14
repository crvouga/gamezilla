/**
 * {@link SqlClient} over a single {@link Client} (one TCP session). For
 * Cloudflare Workers (TCP via nodejs_compat): construct per request; do not share
 * across requests.
 */

import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-root-shared/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared/postgres-db-scope';
import type { Sql, Value } from '@pkgs/sql-root-shared/sql';
import {
  createPgSessionClient,
  pgQueryRows,
  pgQueryWithOptionalSearchPathPin,
  pgRunResultFromQuery,
} from './impl-pg-shared';
import type { Client } from './pg-types';
import { assertPgSessionSchema, setPgSessionSchema } from './session-schema';

export class SqlClientImplPgClient implements PostgresSqlClient {
  constructor(
    private readonly client: Client,
    readonly dbScope: PostgresDbScope,
    private readonly pinSearchPathEachQuery = false
  ) {}

  async connect(): Promise<void> {
    await setPgSessionSchema(this.client, this.dbScope);
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

  async query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const res = await this.pgQuery(query.sql, [...query.values]);
    return pgQueryRows<T>(res);
  }

  async run(query: Sql<unknown>): Promise<RunResult> {
    const res = await this.pgQuery(query.sql, [...query.values]);
    return pgRunResultFromQuery(res);
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const text = query.sql;
    return {
      query: async (params?: Value[]) => {
        const res = await this.pgQuery(text, params);
        return pgQueryRows<T>(res);
      },
      run: async (params?: Value[]) => {
        const res = await this.pgQuery(text, params);
        return pgRunResultFromQuery(res);
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    try {
      await this.client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      if (this.pinSearchPathEachQuery) {
        await setPgSessionSchema(this.client, this.dbScope);
      }
      const txSql = createPgSessionClient(this.client, this.dbScope);
      const out = await fn(txSql);
      await this.client.query('COMMIT');
      return out;
    } catch (err) {
      await this.client.query('ROLLBACK');
      throw err;
    }
  }
}
