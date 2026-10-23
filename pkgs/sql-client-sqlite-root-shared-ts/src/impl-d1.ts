import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql, Value } from '@pkgs/sql-root-shared-ts/sql';

/**
 * D1Database binding shape. Matches the Cloudflare Workers D1 API.
 * Declared here so the shared package doesn't need @cloudflare/workers-types.
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number; changed_db?: boolean };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export class SqlClientImplD1 implements SqlClient {
  constructor(private readonly db: D1Database) {}

  connect(): Promise<void> {
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const stmt = this.db.prepare(query.sql);
    const params = query.values;
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.all<T>();
    return result.results ?? [];
  }

  async run(query: Sql<unknown>): Promise<RunResult> {
    const stmt = this.db.prepare(query.sql);
    const params = query.values;
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.run();
    return {
      changes: result.meta.changes ?? 0,
      lastInsertRowid: result.meta.last_row_id ?? 0,
    };
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const text = query.sql;
    return {
      query: async (params?: Value[]): Promise<T[]> => {
        const stmt = this.db.prepare(text);
        const values = params ?? [];
        const bound = values.length > 0 ? stmt.bind(...values) : stmt;
        const result = await bound.all<T>();
        return result.results ?? [];
      },
      run: async (params?: Value[]): Promise<RunResult> => {
        const stmt = this.db.prepare(text);
        const values = params ?? [];
        const bound = values.length > 0 ? stmt.bind(...values) : stmt;
        const result = await bound.run();
        return {
          changes: result.meta.changes ?? 0,
          lastInsertRowid: result.meta.last_row_id ?? 0,
        };
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
}
