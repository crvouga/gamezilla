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
import { createPgSessionClient, readLastInsertRowid } from './impl-pg-shared';
import type {
  PostgresSqlClient,
  PreparedStatement,
  RunResult,
  SqlClient,
} from './interface';
import type { PostgresDbScope } from './postgres-schema';
import { assertPgSessionSchema } from './postgres-session-schema';
import { questionMarkParamsToDollarParams } from './positional-params';

export { SqlClientImplPgClient } from './impl-pg-client';

export class SqlClientImplPg implements PostgresSqlClient {
  constructor(
    private readonly pool: Pool,
    readonly dbScope: PostgresDbScope
  ) {}

  async connect(): Promise<void> {
    await assertPgSessionSchema(this.pool, this.dbScope);
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const [text, vals] = questionMarkParamsToDollarParams(sql, params);
    const res = await this.pool.query(text, vals);
    return res.rows as T[];
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const [text, vals] = questionMarkParamsToDollarParams(sql, params);
    const res = await this.pool.query(text, vals);
    return {
      changes: res.rowCount ?? 0,
      lastInsertRowid: readLastInsertRowid(
        res.rows as Record<string, unknown>[]
      ),
    };
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
