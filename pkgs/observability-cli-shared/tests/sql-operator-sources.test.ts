import { describe, expect, test } from 'bun:test';
import { SqlMutationTraceIndex } from '@pkgs/observability-cli-shared/sql-mutation-trace-index';
import { SqlPgStatsSource } from '@pkgs/observability-cli-shared/sql-pg-stats';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { Sql } from '@pkgs/sql-root-shared/sql';

function queryClient(
  query: (statement: string) => Promise<readonly Record<string, unknown>[]>
): Pick<SqlClient, 'query'> {
  return {
    async query<T extends Record<string, unknown>>(
      statement: Sql<T>
    ): Promise<T[]> {
      return (await query(statement.sql)) as T[];
    },
  };
}

describe('read-only SQL operator sources', () => {
  test('pg stats bounds its SELECT and extracts sqlcommenter correlation', async () => {
    let statement = '';
    const source = new SqlPgStatsSource(
      queryClient((text) => {
        statement = text;
        return Promise.resolve([
          {
            calls: '3',
            example_trace_id: '11111111111111111111111111111111',
            mean_exec_ms: '12.5',
            query: 'SELECT 1',
            query_id: '42',
            rows: '3',
            total_exec_ms: '37.5',
          },
        ]);
      })
    );
    const result = await source.slowest(1_000);
    expect(statement).toContain('FROM pg_stat_statements');
    expect(statement).toContain('LIMIT ?');
    expect(result).toEqual({
      available: true,
      statements: [
        {
          calls: 3,
          exampleTraceId: '11111111111111111111111111111111',
          meanExecMs: 12.5,
          query: 'SELECT 1',
          queryId: '42',
          rows: 3,
          totalExecMs: 37.5,
        },
      ],
    });
  });

  test('pg stats reports missing grants without leaking errors', async () => {
    const source = new SqlPgStatsSource(
      queryClient(() => Promise.reject(new Error('secret connection detail')))
    );
    expect(await source.slowest(10)).toEqual({
      available: false,
      note: 'pg_stat_statements unavailable (extension, SELECT grant, or server support missing)',
    });
  });

  test('mutation index returns bounded authoritative trace ids', async () => {
    let statement = '';
    const index = new SqlMutationTraceIndex(
      queryClient((text) => {
        statement = text;
        return Promise.resolve([
          { trace_id: 'server-trace-1' },
          { trace_id: 'server-trace-2' },
        ]);
      })
    );
    expect(await index.findTraceIds('offline-1')).toEqual([
      'server-trace-1',
      'server-trace-2',
    ]);
    expect(statement).toContain('sync_engine_observability_events');
    expect(statement).toContain('LIMIT');
  });
});
