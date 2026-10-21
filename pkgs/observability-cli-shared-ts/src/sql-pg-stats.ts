import type {
  PgStatementStat,
  PgStatsResult,
  PgStatsSource,
} from '@pkgs/observability-root-shared-ts/pg-stats';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

const MAX_STATEMENTS = 100;

type PgStatementRow = {
  readonly calls: number | string;
  readonly example_trace_id: string | null;
  readonly mean_exec_ms: number | string;
  readonly query: string;
  readonly query_id: number | string | null;
  readonly rows: number | string;
  readonly total_exec_ms: number | string;
};

function numeric(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statement(row: PgStatementRow): PgStatementStat {
  return {
    calls: numeric(row.calls),
    meanExecMs: numeric(row.mean_exec_ms),
    query: row.query,
    queryId: String(row.query_id ?? 'unknown'),
    rows: numeric(row.rows),
    totalExecMs: numeric(row.total_exec_ms),
    ...(row.example_trace_id === null
      ? {}
      : { exampleTraceId: row.example_trace_id }),
  };
}

/** SELECT-only pg_stat_statements reader for an injected, restricted client. */
export class SqlPgStatsSource implements PgStatsSource {
  readonly #db: Pick<SqlTx, 'query'>;

  constructor(db: Pick<SqlTx, 'query'>) {
    this.#db = db;
  }

  async slowest(limit: number): Promise<PgStatsResult> {
    const bounded = Math.max(1, Math.min(MAX_STATEMENTS, Math.floor(limit)));
    try {
      const rows = await this.#db.query(sql<PgStatementRow>`
        SELECT
          queryid AS query_id,
          query,
          calls,
          total_exec_time AS total_exec_ms,
          mean_exec_time AS mean_exec_ms,
          rows,
          (regexp_match(query, 'traceparent=''00-([0-9a-f]{32})-'))[1]
            AS example_trace_id
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY mean_exec_time DESC
        LIMIT ${bounded}
      `);
      return { available: true, statements: rows.map(statement) };
    } catch {
      return {
        available: false,
        note: 'pg_stat_statements unavailable (extension, SELECT grant, or server support missing)',
      };
    }
  }
}
