import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import { applyFullMerge, detachScope } from '../../client/merge';
import { scopeHash } from '../shared/canonical';
import {
  createScenarioClients,
  openScenarioDb,
  setNote,
} from './scenario-fixture';

describe('merge scenarios', () => {
  test('tombstone row syncs down through snapshot', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const scope = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: scope,
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          {
            id: 'n1',
            body: 'removed',
            owner_id: 'actor',
            _deleted_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      },
    });

    const rows = await db.query(sql<{ deleted: string | null }>`
      SELECT _deleted_at AS deleted FROM notes WHERE id = ${'n1'}
    `);
    expect(rows).toEqual([{ deleted: '2026-01-02T00:00:00.000Z' }]);
  });

  test('live snapshot revives a tombstoned row', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const scope = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: scope,
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          {
            id: 'n1',
            body: 'old',
            owner_id: 'actor',
            _deleted_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      },
    });
    await applyFullMerge(mergeDeps, {
      scopeHash: scope,
      checkpoint: '2',
      hash: 'h2',
      tables: {
        notes: [
          {
            id: 'n1',
            body: 'revived',
            owner_id: 'actor',
            _deleted_at: null,
          },
        ],
      },
    });

    const rows = await db.query(sql<{
      body: string;
      deleted: string | null;
    }>`
      SELECT body, _deleted_at AS deleted FROM notes WHERE id = ${'n1'}
    `);
    expect(rows).toEqual([{ body: 'revived', deleted: null }]);
  });

  test('detach drops scope metadata and keeps domain rows', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const scope = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: scope,
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          {
            id: 'n1',
            body: 'keep',
            owner_id: 'actor',
            _deleted_at: null,
          },
        ],
      },
    });
    await detachScope(mergeDeps, scope);

    const notes = await db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = ${'n1'} AND _deleted_at IS NULL
    `);
    const meta = await db.query(sql<{ scope_hash: string }>`
      SELECT scope_hash FROM _scope_meta WHERE scope_hash = ${scope}
    `);
    expect(notes).toEqual([{ id: 'n1' }]);
    expect(meta).toEqual([]);
  });

  test('pending mutation survives merge and is rebased', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    const result = await mutateClient.mutate(setNote, {
      id: 'n1',
      body: 'optimistic',
    });
    expect(result.ok).toBe(true);

    await applyFullMerge(mergeDeps, {
      scopeHash: scopeHash('notes', {}),
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          {
            id: 'n1',
            body: 'server',
            owner_id: 'actor',
            _deleted_at: null,
          },
        ],
      },
    });

    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    const pending = await db.query(sql<{ id: string }>`
      SELECT id FROM _mutations
    `);
    expect(notes).toEqual([{ body: 'optimistic' }]);
    expect(pending).toHaveLength(1);
  });

  test('older checkpoint cannot overwrite a newer snapshot', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const scope = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: scope,
      checkpoint: '10',
      hash: 'h10',
      tables: {
        notes: [{ id: 'n1', body: 'new', owner_id: 'actor' }],
      },
    });
    const result = await applyFullMerge(mergeDeps, {
      scopeHash: scope,
      checkpoint: '5',
      hash: 'h5',
      tables: {
        notes: [{ id: 'n1', body: 'old', owner_id: 'actor' }],
      },
    });

    const rows = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(result).toBe('stale');
    expect(rows).toEqual([{ body: 'new' }]);
  });

  test('concurrent merges serialize per database', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const results = await Promise.all([
      applyFullMerge(mergeDeps, {
        scopeHash: scopeHash('notes-a', {}),
        checkpoint: '1',
        hash: 'ha',
        tables: {
          notes: [{ id: 'n1', body: 'a', owner_id: 'actor' }],
        },
      }),
      applyFullMerge(mergeDeps, {
        scopeHash: scopeHash('notes-b', {}),
        checkpoint: '1',
        hash: 'hb',
        tables: {
          notes: [{ id: 'n2', body: 'b', owner_id: 'actor' }],
        },
      }),
    ]);
    const rows = await db.query(sql<{ id: string }>`
      SELECT id FROM notes ORDER BY id
    `);

    expect(results).toEqual(['applied', 'applied']);
    expect(rows).toEqual([{ id: 'n1' }, { id: 'n2' }]);
  });
});
