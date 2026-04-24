/**
 * {@link SqlClient} backed by a PGlite HTTP server.
 *
 * The server exposes a single `POST /sql` endpoint that accepts
 * `{ sql, params? }` and returns `{ rows, affectedRows, truncated }`.
 *
 * Designed for local dev — mirrors PlanetScale HTTP API limits so issues
 * surface before hitting production.
 */

import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

interface SqlResponse {
  rows: Record<string, unknown>[];
  affectedRows: number;
  truncated: boolean;
}

export class SqlClientImplPgliteHttp implements SqlClient {
  private readonly baseUrl: string;
  private inTransaction = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async connect(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`PGlite HTTP health check failed: ${res.status}`);
    }
  }

  async disconnect(): Promise<void> {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    const data = await this.post(sql, params);
    return data.rows as T[];
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const data = await this.post(sql, params);
    return {
      changes: data.affectedRows,
      lastInsertRowid: getLastInsertRowid(data.rows),
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
    if (this.inTransaction) {
      throw new Error('Nested transactions are not supported');
    }
    this.inTransaction = true;
    try {
      await this.post('BEGIN');
      const result = await fn(this);
      await this.post('COMMIT');
      return result;
    } catch (e) {
      try {
        await this.post('ROLLBACK');
      } catch {
        /* best-effort rollback */
      }
      throw e;
    } finally {
      this.inTransaction = false;
    }
  }

  private async post(sql: string, params?: unknown[]): Promise<SqlResponse> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const res = await fetch(`${this.baseUrl}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: pgSql,
        params: pgParams.length > 0 ? pgParams : undefined,
      }),
    });
    if (!res.ok) {
      const body: { error?: string } = await res
        .json()
        .catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as SqlResponse;
  }
}

function getLastInsertRowid(rows: Record<string, unknown>[]): number {
  const first = rows[0];
  if (first != null && 'id' in first) {
    const id = first['id'];
    if (typeof id === 'number') return id;
    if (typeof id === 'bigint') return Number(id);
    if (typeof id === 'string') return parseInt(id, 10) || 0;
  }
  return 0;
}
