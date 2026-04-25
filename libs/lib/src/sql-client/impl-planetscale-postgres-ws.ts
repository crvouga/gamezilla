import { Client, neonConfig } from '@neondatabase/serverless';
import { assert } from '../assert';
import { WsTransactionSqlClient } from './impl-planetscale-postgres-ws-tx';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

/**
 * {@link SqlClient} over the Neon serverless driver's WebSocket `Client`.
 * Provides real `BEGIN` / `COMMIT` transactions with `SERIALIZABLE` isolation.
 *
 * Use this when correctness requires database-level transaction semantics (e.g.
 * mutexes, compare-and-swap). For idempotent HTTP-only workloads, prefer
 * {@link SqlClientImplPlanetScalePostgres}.
 *
 * PlanetScale Postgres uses the same Neon-compatible endpoint as the HTTP path;
 * {@link neonConfig.fetchEndpoint} is set for consistency with other call sites.
 */
export class SqlClientImplPlanetScalePostgresWs implements SqlClient {
  private client: Client | null = null;
  private readonly connectionString: string;
  /** Serializes all operations — one connection, no concurrent interleaved queries. */
  private tail: Promise<void> = Promise.resolve();

  constructor(connectionString: string) {
    assert.ok(
      connectionString.startsWith('postgres'),
      'SqlClientImplPlanetScalePostgresWs: connection string must be postgres',
      { connectionString: `${connectionString.slice(0, 12)}…` }
    );
    this.connectionString = connectionString;
    neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  async connect(): Promise<void> {
    await this.enqueue(async () => {
      assert.ok(this.client === null, 'already connected');
      const c = new Client(this.connectionString);
      await c.connect();
      this.client = c;
    });
  }

  async disconnect(): Promise<void> {
    await this.enqueue(async () => {
      if (this.client === null) return;
      await this.client.end();
      this.client = null;
    });
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    return this.enqueue(async () => {
      const c = assertConnected(this.client);
      const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
      const result = await c.query(pgSql, pgParams);
      return result.rows as T[];
    });
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    return this.enqueue(async () => {
      const c = assertConnected(this.client);
      const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
      const result = await c.query(pgSql, pgParams);
      return {
        changes: result.rowCount ?? 0,
        lastInsertRowid: getLastInsertRowid(
          result.rows as Record<string, unknown>[]
        ),
      };
    });
  }

  prepare(sql: string): PreparedStatement {
    return {
      query: <T = Record<string, unknown>>(params?: unknown[]) =>
        this.query<T>(sql, params),
      run: (params?: unknown[]) => this.run(sql, params),
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const c = assertConnected(this.client);
      await c.query(
        'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE'
      );
      const scoped = new WsTransactionSqlClient(c);
      try {
        const out = await fn(scoped);
        await c.query('COMMIT');
        return out;
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    });
  }
}

function assertConnected(c: Client | null): Client {
  assert.ok(c !== null, 'SqlClientImplPlanetScalePostgresWs: not connected');
  return c;
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
