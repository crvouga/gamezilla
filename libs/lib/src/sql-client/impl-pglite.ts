/**
 * {@link SqlClient} backed by an in-process PGlite engine (same process as the caller).
 *
 * Use when there is no PGlite HTTP server yet — for example `apps/db` runs migrations
 * before mounting the SQL app. {@link SqlClientImplPglite#transaction} does not open a
 * real DB transaction (same behaviour as the prior inline adapter in `migrate.ts` and
 * as {@link SqlClientImplPgliteHttp#transaction}).
 */
import { assert } from '../assert';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

/** Minimal surface of `@electric-sql/pglite`’s `PGlite` needed for SQL execution. */
export type PgliteSqlEngine = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{
    rows: T[];
    affectedRows?: number | null;
  }>;
};

export class SqlClientImplPglite implements SqlClient {
  constructor(private readonly db: PgliteSqlEngine) {}

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.db.query<T>(
      pgSql,
      pgParams.length > 0 ? pgParams : undefined
    );
    assert.array(result.rows, 'PGlite query result.rows must be an array');
    return result.rows;
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.db.query(
      pgSql,
      pgParams.length > 0 ? pgParams : undefined
    );
    const rows = result.rows as Record<string, unknown>[];
    const changes = result.affectedRows ?? 0;
    assert.nonNegativeInteger(
      changes,
      'PGlite affectedRows must be a non-negative safe integer'
    );
    return { changes, lastInsertRowid: readIdFromFirstRow(rows[0]) };
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

function readIdFromFirstRow(
  first: Record<string, unknown> | undefined
): number {
  if (first === undefined) return 0;
  const id = first['id'];
  if (typeof id === 'number' && Number.isInteger(id)) return id;
  if (typeof id === 'bigint') return Number(id);
  if (typeof id === 'string') return parseInt(id, 10) || 0;
  return 0;
}
