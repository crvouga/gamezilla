import { expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PatchDbQuery } from '../interface';
import { readPatches } from './read-ops';

function patchRow(
  patchId: string,
  entityId: string,
  entityType: string
): Record<string, unknown> {
  return {
    patch_id: patchId,
    entity_id: entityId,
    entity_type: entityType,
    attributes: '{}',
    created_at: 't0',
    recorded_at: 't0',
    parent_id: null,
  };
}

function createCapturingSqlClient(patchRows: Record<string, unknown>[]): {
  client: SqlClient;
  statements: string[];
} {
  const statements: string[] = [];
  const client: SqlClient = {
    connect: async () => {},
    disconnect: async () => {},
    query: async <T = Record<string, unknown>>(sql: string): Promise<T[]> => {
      statements.push(sql);
      if (sql.includes('FROM snapshots') && sql.includes('IN (VALUES')) {
        return [
          {
            entity_id: 'e1',
            entity_type: 'space',
            attributes: '{}',
          },
        ] as T[];
      }
      if (sql.includes('RECURSIVE lineage')) {
        return patchRows as T[];
      }
      return [] as T[];
    },
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>) => fn(client),
    prepare: () => {
      throw new Error('prepare not used in readPatches');
    },
  };
  return { client, statements };
}

test('solo bare entity read uses snapshot fast-path (no readOnePatchBased cand CTE)', async () => {
  const { client, statements } = createCapturingSqlClient([
    patchRow('p1', 'e1', 'space'),
  ]);
  const q: PatchDbQuery = {
    entityType: 'space',
    entityId: 'e1',
  };
  await readPatches(client, [q]);
  const joined = statements.join('\n');
  expect(joined).toContain('RECURSIVE lineage');
  expect(joined).not.toContain('cand AS');
  expect(joined).not.toContain('matching_entities');
});

test('bare read with knownPatchIds adds NOT IN on patch fetch', async () => {
  const { client, statements } = createCapturingSqlClient([
    patchRow('p2', 'e1', 'space'),
  ]);
  const q: PatchDbQuery = {
    entityType: 'space',
    entityId: 'e1',
    knownPatchIds: ['p1'],
  };
  await readPatches(client, [q]);
  const patchSql = statements.find((s) => s.includes('RECURSIVE lineage'));
  expect(patchSql).toBeDefined();
  expect(patchSql!).toContain('NOT IN');
  expect(patchSql!).toContain('?');
});

test('bare read without limit returns all patches from lineage result', async () => {
  const { client } = createCapturingSqlClient([
    patchRow('p1', 'e1', 'space'),
    patchRow('p2', 'e1', 'space'),
  ]);
  const q: PatchDbQuery = {
    entityType: 'space',
    entityId: 'e1',
  };
  const [res] = await readPatches(client, [q]);
  expect(res).toBeDefined();
  expect(res!.patches.length).toBe(2);
});

test('bare read with limit 1 returns one patch', async () => {
  const { client } = createCapturingSqlClient([
    patchRow('p1', 'e1', 'space'),
    patchRow('p2', 'e1', 'space'),
  ]);
  const q: PatchDbQuery = {
    entityType: 'space',
    entityId: 'e1',
    limit: 1,
  };
  const [res] = await readPatches(client, [q]);
  expect(res).toBeDefined();
  expect(res!.patches.length).toBe(1);
  expect(res!.patches[0]!.patchId).toBe('p1');
});
