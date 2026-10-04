import type { MutationTraceIndex } from '@pkgs/observability-shared/mutation-trace-index';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';

const MAX_TRACE_IDS = 16;

/** Read-only recovery path when mutation spans age out of the trace index. */
export class SqlMutationTraceIndex implements MutationTraceIndex {
  constructor(private readonly db: Pick<SqlClient, 'query'>) {}

  async findTraceIds(mutationId: string): Promise<readonly string[]> {
    const rows = await this.db.query(sql<{ trace_id: string }>`
      SELECT DISTINCT trace_id
      FROM sync_engine_observability_events
      WHERE mutation_id = ${mutationId}
        AND trace_id IS NOT NULL
        AND deleted_at IS NULL
      ORDER BY trace_id ASC
      LIMIT ${MAX_TRACE_IDS}
    `);
    return rows.map((row) => row.trace_id);
  }
}
