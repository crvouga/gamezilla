/**
 * {@link SqlClient} backed by `node-postgres` (`pg.Pool` or `pg.Client`).
 *
 * Works in Bun/Node and in Cloudflare Workers with `nodejs_compat` (TCP to
 * Postgres). Uses real `BEGIN`/`COMMIT` in {@link SqlClient#transaction}.
 *
 * Prefer {@link SqlClientImplPgClient} with Cloudflare Hyperdrive (one client per
 * request; no module-scope pool).
 */
import type { Client, Pool, PoolClient } from 'pg';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

function readLastInsertRowid(rows: Record<string, unknown>[]): number {
  const first = rows[0];
  if (first !== undefined && first !== null && 'id' in first) {
    const id = first['id'];
    if (typeof id === 'number') return id;
    if (typeof id === 'bigint') return Number(id);
    if (typeof id === 'string') return parseInt(id, 10) || 0;
  }
  return 0;
}

/** `PoolClient` or `Client` — anything that can run parameterized queries. */
type PgQueryable = Pick<PoolClient, 'query'>;

function createPgSessionClient(poolClient: PgQueryable): SqlClient {
  const self: SqlClient = {
    connect: async () => {
      /* connection owned by pool */
    },
    disconnect: async () => {
      /* caller releases poolClient */
    },
    query: async <T = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ): Promise<T[]> => {
      const [text, vals] = questionMarkParamsToDollarParams(sql, params);
      const res = await poolClient.query(text, vals);
      return res.rows as T[];
    },
    run: async (sql: string, params?: unknown[]): Promise<RunResult> => {
      const [text, vals] = questionMarkParamsToDollarParams(sql, params);
      const res = await poolClient.query(text, vals);
      return {
        changes: res.rowCount ?? 0,
        lastInsertRowid: readLastInsertRowid(
          res.rows as Record<string, unknown>[]
        ),
      };
    },
    prepare: (sql: string): PreparedStatement => ({
      query: <T = Record<string, unknown>>(params?: unknown[]) =>
        self.query<T>(sql, params),
      run: (params?: unknown[]) => self.run(sql, params),
    }),
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> => {
      return fn(self);
    },
  };
  return self;
}

export class SqlClientImplPg implements SqlClient {
  constructor(private readonly pool: Pool) {}

  async connect(): Promise<void> {
    await this.pool.query('SELECT 1');
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

/**
 * {@link SqlClient} over a single {@link Client} (one TCP session). For Hyperdrive +
 * Workers: construct per request; do not share across requests.
 */
export class SqlClientImplPgClient implements SqlClient {
  constructor(private readonly client: Client) {}

  async connect(): Promise<void> {
    await this.client.query('SELECT 1');
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
