import { expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import { healOptimisticPeerOrphans } from '@pkgs/sync-engine-client-ts/optimistic-peer-rows';

// regression: sync-peer-healing-repeated-pending-scan
for (const size of [1, 10, 100]) {
  test(`healing ${size} tables scans pending writes once and preserves their rows`, async () => {
    let pendingReads = 0;
    let writes = 0;
    const db = {
      query: async (statement: Sql<unknown>) => {
        if (statement.text.includes('COUNT(*)')) return [{ c: size }];
        if (statement.text.includes('FROM sync_engine_mutations')) {
          pendingReads += 1;
          return [{ id: 'pending-write' }];
        }
        return [{ row_id: 'local-note', mutation_id: 'pending-write' }];
      },
      run: async () => {
        writes += 1;
        return { changes: 1 };
      },
    } as unknown as SqlClient;
    const tables = Object.fromEntries(
      Array.from({ length: size }, (_, i) => [`notes_${i}`, []])
    );
    expect(
      await healOptimisticPeerOrphans(db, tables, '2026-10-30T00:00:00Z')
    ).toEqual([]);
    expect(pendingReads).toBe(1);
    expect(writes).toBe(0);
  });
}
