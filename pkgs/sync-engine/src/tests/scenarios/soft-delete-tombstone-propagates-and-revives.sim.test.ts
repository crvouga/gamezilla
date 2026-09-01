import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import {
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  readNoteTombstone,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('soft delete tombstone propagates and revives', () => {
  test('delete tombstones on peer after converge', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 13,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'x' });
    await world.assertConverged();

    const del = await a.mutate(deleteNote, { id: 'n1' });
    expect(del.ok).toBe(true);
    await world.assertConverged();

    await expectNoteNotLive(b.db, 'n1');
    const tomb = await readNoteTombstone(b.db, 'n1');
    expect(tomb).not.toBeNull();
  });

  test('setNote after delete revives the row', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 14,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'first' });
    await world.assertConverged();
    await a.mutate(deleteNote, { id: 'n1' });
    await world.assertConverged();
    await expectNoteNotLive(b.db, 'n1');

    await a.mutate(setNote, { id: 'n1', body: 'revived' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'revived' });
    expect(await readNoteTombstone(b.db, 'n1')).toBeNull();
  });
});
