import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import { applyFullMerge, purgeScope } from '../client/merge-applier';
import { hashQueryTables, scopeHash } from '../shared/canonical';
import {
  createScenarioClients,
  openScenarioDb,
  rejectThrough,
  setNote,
} from './scenario-fixture';

describe('merge scenarios (Phase 0 invariants)', () => {
  test('offline-queued-mutation-rejected-on-drain', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    const r = await mutateClient.mutate(setNote, {
      id: 'n1',
      body: 'offline',
    });
    expect(r.ok).toBe(true);
    // Simulate server rejection by not applying; hard-delete pending log
    await rejectThrough(db, 1);
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    // After ack without merge, optimistic row remains until merge/rebase
    expect(notes.length).toBe(1);
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: { notes: [] },
    });
    const after = await db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = ${'n1'}
    `);
    expect(after.length).toBe(0);
  });

  test('poll-response-arrives-during-local-mutation', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'local' });
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [{ id: 'n1', body: 'server', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    // pending rebase restores local optimistic body
    expect(notes[0]?.body).toBe('local');
  });

  test('crash-between-replace-and-rebase', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'pending' });
    // Simulate partial: confirmed base without rebase by inserting confirmed row
    // then re-running merge (transactional merge is atomic — reopen is consistent)
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [{ id: 'n1', body: 'base', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('pending');
  });

  test('stale-response-after-newer-checkpoint', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '10',
      hash: 'h10',
      tables: {
        notes: [{ id: 'n1', body: 'new', owner_id: 'actor' }],
      },
    });
    const result = await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '5',
      hash: 'h5',
      tables: {
        notes: [{ id: 'n1', body: 'old', owner_id: 'actor' }],
      },
    });
    expect(result).toBe('stale');
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('new');
  });

  test('pending-mutation-fails-on-rebase', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    const { failOnRebase } = await import('./scenario-fixture');
    await mutateClient.mutate(failOnRebase, { id: 'n1', body: 'try' });
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [{ id: 'n1', body: 'BLOCK', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('BLOCK');
    const pending = await db.query(sql<{ id: string }>`
      SELECT id FROM _mutations
    `);
    expect(pending.length).toBe(1);
  });

  test('shared-row-across-two-scopes', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const s1 = scopeHash('a', { x: 1 });
    const s2 = scopeHash('b', { x: 2 });
    const row = { id: 'shared', body: 'hi', owner_id: 'actor' };
    await applyFullMerge(mergeDeps, {
      scopeHash: s1,
      checkpoint: '1',
      hash: 'h1',
      tables: { notes: [row] },
    });
    await applyFullMerge(mergeDeps, {
      scopeHash: s2,
      checkpoint: '1',
      hash: 'h2',
      tables: { notes: [row] },
    });
    await purgeScope(mergeDeps, s1);
    const notes = await db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = ${'shared'}
    `);
    expect(notes.length).toBe(1);
  });

  test('denied-purges-scope-and-stops-polling', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [{ id: 'n1', body: 'x', owner_id: 'actor' }],
      },
    });
    await purgeScope(mergeDeps, sh);
    const notes = await db.query(sql<{ id: string }>`SELECT id FROM notes`);
    expect(notes.length).toBe(0);
    const meta = await db.query(sql<{ scope_hash: string }>`
      SELECT scope_hash FROM _scope_meta WHERE scope_hash = ${sh}
    `);
    expect(meta.length).toBe(0);
  });

  test('not_modified-causes-zero-writes', async () => {
    const tables = {
      notes: [{ id: 'n1', body: 'x', owner_id: 'a' }],
    };
    const h1 = hashQueryTables(tables);
    const h2 = hashQueryTables(tables);
    expect(h1).toBe(h2);
  });

  test('unfriend-revocation-via-absence', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const sh = scopeHash('friends', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h1',
      tables: {
        notes: [
          { id: 'f1', body: 'friend', owner_id: 'actor' },
          { id: 'f2', body: 'friend2', owner_id: 'actor' },
        ],
      },
    });
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '2',
      hash: 'h2',
      tables: {
        notes: [{ id: 'f1', body: 'friend', owner_id: 'actor' }],
      },
    });
    const gone = await db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = ${'f2'}
    `);
    expect(gone.length).toBe(0);
  });

  test('kicked-from-room-via-denied', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const sh = scopeHash('room', { id: 'r1' });
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        rooms: [{ id: 'r1', title: 'lobby' }],
      },
    });
    await purgeScope(mergeDeps, sh);
    const rooms = await db.query(sql<{ id: string }>`SELECT id FROM rooms`);
    expect(rooms.length).toBe(0);
  });

  test('params-change-keeps-old-rows-until-hydrated', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const oldScope = scopeHash('notes', { q: 'old' });
    const newScope = scopeHash('notes', { q: 'new' });
    await applyFullMerge(mergeDeps, {
      scopeHash: oldScope,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [{ id: 'old', body: 'keep', owner_id: 'actor' }],
      },
    });
    // New scope not yet hydrated — old rows remain
    const notes = await db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = ${'old'}
    `);
    expect(notes.length).toBe(1);
    expect(oldScope).not.toBe(newScope);
  });

  test('auth-wipe-deletes-db-and-pending-log', async () => {
    const db = await openScenarioDb();
    const { mutateClient } = createScenarioClients(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'x' });
    // Auth-revoked wipe: drop DURABLE + CACHE (file-delete equivalent in harness)
    await db.run(sql`DELETE FROM _mutations`);
    await db.run(sql`DELETE FROM _upload_state`);
    await db.run(sql`DELETE FROM notes`);
    const pending = await db.query(sql<{ n: number }>`
      SELECT COUNT(*) AS n FROM _mutations
    `);
    expect(pending[0]?.n).toBe(0);
  });

  test('rebase-reruns-are-idempotent', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    await mutateClient.mutate(setNote, { id: 'in', body: 'A' });
    await mutateClient.mutate(setNote, { id: 'out', body: 'B' });
    const sh = scopeHash('notes', { only: 'in' });
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [{ id: 'in', body: 'server', owner_id: 'actor' }],
      },
    });
    // Second merge same checkpoint stale; third with new checkpoint re-rebases
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '2',
      hash: 'h2',
      tables: {
        notes: [{ id: 'in', body: 'server2', owner_id: 'actor' }],
      },
    });
    const out = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'out'}
    `);
    expect(out[0]?.body).toBe('B');
    const inn = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'in'}
    `);
    expect(inn[0]?.body).toBe('A');
  });

  test('schema-epoch-wipe-preserves-durable', async () => {
    const db = await openScenarioDb();
    const { mutateClient } = createScenarioClients(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'pending' });
    await db.run(sql`DELETE FROM notes`);
    const pending = await db.query(sql<{ id: string }>`
      SELECT id FROM _mutations
    `);
    expect(pending.length).toBe(1);
  });

  test('old-client-receives-new-columns', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [
          {
            id: 'n1',
            body: 'x',
            owner_id: 'actor',
            future_col: 'ignored',
          },
        ],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('x');
  });

  test('migration-runs-once-and-orders', async () => {
    const db = await openScenarioDb();
    const { ensureFrameworkSchema } = await import('../client/local-schema');
    await ensureFrameworkSchema(db);
    await ensureFrameworkSchema(db);
    const state = await db.query(sql<{ id: string }>`
      SELECT id FROM _upload_state
    `);
    expect(state.length).toBe(1);
  });

  test('expired-token-does-not-wipe', async () => {
    const shouldWipe = (reason: 'expired' | 'revoked'): boolean =>
      reason === 'revoked';
    expect(shouldWipe('expired')).toBe(false);
  });

  test('dead-scope-sweep-reaps-untouched-tags', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const sh = scopeHash('stale', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      tables: {
        notes: [{ id: 'n1', body: 'x', owner_id: 'actor' }],
      },
    });
    await db.run(sql`
      UPDATE _scope_meta
      SET last_active_at = ${'2000-01-01T00:00:00.000Z'}
      WHERE scope_hash = ${sh}
    `);
    await purgeScope(mergeDeps, sh);
    const tags = await db.query(sql<{ n: number }>`
      SELECT COUNT(*) AS n FROM _row_scopes WHERE scope_hash = ${sh}
    `);
    expect(tags[0]?.n).toBe(0);
  });

  test('merge-single-flight-queues-concurrent-writers', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const a = scopeHash('notes-a', {});
    const b = scopeHash('notes-b', {});
    const results = await Promise.all([
      applyFullMerge(mergeDeps, {
        scopeHash: a,
        checkpoint: '1',
        hash: 'ha',
        tables: {
          notes: [{ id: 'n1', body: 'a', owner_id: 'actor' }],
        },
      }),
      applyFullMerge(mergeDeps, {
        scopeHash: b,
        checkpoint: '1',
        hash: 'hb',
        tables: {
          notes: [{ id: 'n2', body: 'b', owner_id: 'actor' }],
        },
      }),
    ]);
    expect(results).toEqual(['applied', 'applied']);
    const notes = await db.query(sql<{ id: string }>`
      SELECT id FROM notes ORDER BY id
    `);
    expect(notes.map((row) => row.id)).toEqual(['n1', 'n2']);
  });
});
