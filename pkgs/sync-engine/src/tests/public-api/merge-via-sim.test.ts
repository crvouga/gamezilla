import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import { syncFacade } from '../../sim/system';
import {
  acmeLocalSchemaExtraColumn,
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  readNoteTombstone,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

/**
 * Public-API / sim pins for merge semantics that bulk upsert must preserve:
 * column-intersect (missing keys), tombstone upsert, pending rebase.
 */
describe('public API: merge via openWorld', () => {
  test('missing server keys do not null local-only columns', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 9001,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({
      id: 'alice',
      localSchema: acmeLocalSchemaExtraColumn,
    });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'v1' });
    await world.assertConverged();

    await a.db.run(sql`
      UPDATE notes SET color = ${'red'} WHERE id = ${'n1'}
    `);
    await b.mutate(setNote, { id: 'n1', body: 'from-bob' });
    await world.assertConverged();

    await expectLiveNote(a.db, 'n1', { body: 'from-bob' });
    const after = await a.db.query(sql<{ color: string | null }>`
      SELECT color FROM notes WHERE id = ${'n1'} AND deleted_at IS NULL
    `);
    expect(after[0]?.color).toBe('red');
  });

  test('tombstone upsert removes live peer row; pending rebase wins after disconnect', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 9002,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'seed' });
    await world.assertConverged();

    await a.mutate(deleteNote, { id: 'n1' });
    await world.assertConverged();
    await expectNoteNotLive(b.db, 'n1');
    expect(await readNoteTombstone(b.db, 'n1')).not.toBeNull();

    await a.disconnect();
    await a.mutate(setNote, { id: 'n1', body: 'optimistic-pending' });
    await expectLiveNote(a.db, 'n1', { body: 'optimistic-pending' });

    await a.connect();
    await world.runFor(500);
    await expectLiveNote(a.db, 'n1', { body: 'optimistic-pending' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'optimistic-pending' });
  });
});
