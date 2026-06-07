/**
 * {@link SqlClient} over a single {@link Client} (one TCP session). For
 * Cloudflare Hyperdrive + Workers: construct per request; do not share
 * across requests.
 */
import type { Client } from 'pg';
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

export class SqlClientImplPgClient implements PostgresSqlClient {
  constructor(
    private readonly client: Client,
    readonly dbScope: PostgresDbScope
  ) {}

  async connect(): Promise<void> {
    await assertPgSessionSchema(this.client, this.dbScope);
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const [text, vals] = questionMarkParamsToDollarParams(sql, params);
    const res = await this.client.query(text, vals);
    return res.rows as T[];
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const [text, vals] = questionMarkParamsToDollarParams(sql, params);
    const res = await this.client.query(text, vals);
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
    try {
      await this.client.query('BEGIN');
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
