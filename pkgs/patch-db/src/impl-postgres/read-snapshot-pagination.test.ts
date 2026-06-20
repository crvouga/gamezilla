import { expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PatchDbQuery } from '../interface';
import { readPatches } from './read-ops';

function createSnapshotCapturingClient(
  snapshotRows: Array<{ entity_id: string; entity_type: string }>
): { client: SqlClient; statements: string[] } {
  const statements: string[] = [];
  const client: SqlClient = {
    connect: async () => {},
    disconnect: async () => {},
    query: async <T = Record<string, unknown>>(sql: string): Promise<T[]> => {
      statements.push(sql);
      if (sql.includes('FROM snapshots') && !sql.includes('RECURSIVE')) {
        return snapshotRows.map((r) => ({
          ...r,
          attributes: '{}',
        })) as T[];
      }
      if (sql.includes('RECURSIVE lineage')) {
        return [] as T[];
      }
      return [] as T[];
    },
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>) => fn(client),
    prepare: () => {
      throw new Error('prepare not used');
    },
  };
  return { client, statements };
}

test('snapshot list read omits COUNT(*) OVER() and uses limit+1 for hasMore', async () => {
  const rows = Array.from({ length: 3 }, (_, i) => ({
    entity_id: `e${i}`,
    entity_type: 'chess.puzzle',
  }));
  const { client, statements } = createSnapshotCapturingClient(rows);
  const q: PatchDbQuery = {
    entityType: 'chess.puzzle',
    limit: 2,
  };
  const [res] = await readPatches(client, [q]);
  expect(res).toBeDefined();
  expect(res!.entities).toHaveLength(2);
  expect(res!.hasMore).toBe(true);
  const snapshotSql = statements.find(
    (s) => s.includes('FROM snapshots') && !s.includes('RECURSIVE')
  );
  expect(snapshotSql).toBeDefined();
  expect(snapshotSql!).not.toContain('COUNT(*) OVER()');
  expect(snapshotSql!).toContain('LIMIT ?');
});

test('snapshot list read hasMore false when fewer rows than limit', async () => {
  const { client } = createSnapshotCapturingClient([
    { entity_id: 'e1', entity_type: 'chess.puzzle' },
  ]);
  const [res] = await readPatches(client, [
    { entityType: 'chess.puzzle', limit: 50 },
  ]);
  expect(res!.hasMore).toBe(false);
});
