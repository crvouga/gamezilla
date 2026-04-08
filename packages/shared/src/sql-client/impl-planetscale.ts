import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

/**
 * {@link SqlClient} adapter for Postgres via the Neon serverless driver.
 * Uses WebSocket (Pool) for interactive transactions; the HTTP fetch
 * endpoint is configured so that callers using `neon()` can reach
 * PlanetScale over plain HTTP as well.
 *
 * Automatically detects local dev (127.0.0.1 / localhost) and configures
 * the WebSocket proxy accordingly. In production the PlanetScale Postgres
 * proxy is used; locally the PGlite neon-compat WS proxy is expected on
 * the same host:port as the connection string.
 *
 * @see https://api-docs.planetscale.com/docs/postgres/connecting/neon-serverless-driver
 */
export class SqlClientImplPlanetScale implements SqlClient {
  private pool: Pool;

  constructor(connectionString: string) {
    configureNeon(connectionString);
    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 10_000,
      max: 5,
    });
  }

  async connect(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.pool.query(pgSql, pgParams);
    return result.rows as T[];
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.pool.query(pgSql, pgParams);
    const rows = result.rows as Record<string, unknown>[];
    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid: getLastInsertRowid(rows),
    };
  }

  prepare(sql: string): PreparedStatement {
    return {
      query: async <T = Record<string, unknown>>(
        params?: unknown[],
      ): Promise<T[]> => {
        return this.query<T>(sql, params);
      },
      run: async (params?: unknown[]): Promise<RunResult> => {
        return this.run(sql, params);
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tx = createTxSqlClient(client);
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

function createTxSqlClient(client: PoolClient): SqlClient {
  const txQuery = async <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> => {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await client.query(pgSql, pgParams);
    return result.rows as T[];
  };

  const txRun = async (
    sql: string,
    params?: unknown[],
  ): Promise<RunResult> => {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await client.query(pgSql, pgParams);
    const rows = result.rows as Record<string, unknown>[];
    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid: getLastInsertRowid(rows),
    };
  };

  return {
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    query: txQuery,
    run: txRun,
    prepare: (sql: string): PreparedStatement => ({
      query: <T = Record<string, unknown>>(params?: unknown[]) =>
        txQuery<T>(sql, params),
      run: (params?: unknown[]) => txRun(sql, params),
    }),
    transaction: () => {
      throw new Error('Nested transactions are not supported');
    },
  };
}

export function configureNeon(connectionString: string) {
  const url = new URL(connectionString.replace(/^postgres(ql)?:\/\//, 'http://'));
  const isLocal =
    url.hostname === '127.0.0.1' || url.hostname === 'localhost';

  neonConfig.pipelineConnect = false;

  if (isLocal) {
    neonConfig.wsProxy = (host, port) => `${host}:${port}/v1`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.forceDisablePgSSL = true;
  } else {
    neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
    neonConfig.wsProxy = (host, port) => `${host}/v2?address=${host}:${port}`;
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
