import type { Client } from '@neondatabase/serverless';
import { assert } from '@gamezilla/assert';
import type { PreparedStatement, RunResult, SqlClient } from './interface';
import { questionMarkParamsToDollarParams } from './positional-params';

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

/**
 * Transaction-scoped client: same underlying connection, no nested transactions.
 */
export class WsTransactionSqlClient implements SqlClient {
  constructor(private readonly c: Client) {}

  async connect(): Promise<void> {
    assert.fail('WsTransactionSqlClient: connect inside transaction');
  }

  async disconnect(): Promise<void> {
    assert.fail('WsTransactionSqlClient: disconnect inside transaction');
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.c.query(pgSql, pgParams);
    return result.rows as T[];
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const [pgSql, pgParams] = questionMarkParamsToDollarParams(sql, params);
    const result = await this.c.query(pgSql, pgParams);
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

  async transaction<T>(_fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    assert.fail('nested transaction not supported on SqlClient');
  }
}
