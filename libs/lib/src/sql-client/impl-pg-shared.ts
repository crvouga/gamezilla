/**
 * Shared helpers for `node-postgres` ({@link Pool} / {@link Client}) backed
 * {@link SqlClient} implementations.
 */
import type { PoolClient } from 'pg';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

export function readLastInsertRowid(rows: Record<string, unknown>[]): number {
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
export type PgQueryable = Pick<PoolClient, 'query'>;

export function createPgSessionClient(poolClient: PgQueryable): SqlClient {
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
