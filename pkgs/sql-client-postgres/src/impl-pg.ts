/**
 * {@link SqlClient} backed by a `node-postgres` {@link Pool}.
 *
 * Works in Bun/Node and in Cloudflare Workers with `nodejs_compat` (TCP to
 * Postgres). Uses real `BEGIN`/`COMMIT` in {@link SqlClient#transaction}.
 *
 * For per-request TCP clients (one client per request, no module-scope pool),
 * prefer `SqlClientImplPgClient` from `./impl-pg-client`.
 */

import type { Sql, Value } from '@pkgs/sql';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import {
  createPgSessionClient,
  pgQueryRows,
  pgQueryWithOptionalSearchPathPin,
  pgRunResultFromQuery,
} from './impl-pg-shared';
import type { Pool } from './pg-types';
import { assertPgSessionSchema, setPgSessionSchema } from './session-schema';

export { SqlClientImplPgClient } from './impl-pg-client';

export class SqlClientImplPg implements PostgresSqlClient {
  constructor(
    private readonly pool: Pool,
    readonly dbScope: PostgresDbScope,
    private readonly pinSearchPathEachQuery = false
  ) {}

  async connect(): Promise<void> {
    await setPgSessionSchema(this.pool, this.dbScope);
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
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
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
