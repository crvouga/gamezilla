import {
  neon,
  neonConfig,
  type NeonQueryFunction,
} from '@neondatabase/serverless';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

/**
 * {@link SqlClient} adapter for Postgres via the Neon serverless driver's
 * stateless HTTP path. No WebSocket connections, no connection pool,
 * no stale connection timeouts in serverless environments.
 *
 * `transaction()` runs the callback's queries sequentially over HTTP without
 * database-level isolation. Safe when operations are idempotent (e.g.
 * INSERT ON CONFLICT DO NOTHING, full snapshot recomputes).
 *
 * @see https://api-docs.planetscale.com/docs/postgres/connecting/neon-serverless-driver
 */
export class SqlClientImplPlanetScalePostgres implements SqlClient {
  private sql: NeonQueryFunction<false, true>;

  constructor(connectionString: string) {
    neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
    this.sql = neon(connectionString, { fullResults: true });
  }

  async connect(): Promise<void> {
    await this.sql.query('SELECT 1');
  }

  async disconnect(): Promise<void> {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.sql.query(pgSql, pgParams);
    return result.rows as T[];
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.sql.query(pgSql, pgParams);
    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid: getLastInsertRowid(
        result.rows as Record<string, unknown>[]
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
    return fn(this);
  }
}

function getLastInsertRowid(rows: Record<string, unknown>[]): number {
  const first = rows[0];
  if (first !== null && first !== undefined && 'id' in first) {
    const id = first['id'];
    if (typeof id === 'number') return id;
    if (typeof id === 'bigint') return Number(id);
    if (typeof id === 'string') return parseInt(id, 10) || 0;
  }
  return 0;
}
