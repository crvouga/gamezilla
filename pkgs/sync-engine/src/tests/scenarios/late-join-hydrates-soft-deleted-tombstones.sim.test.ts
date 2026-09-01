import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { deleteNote, expectNoteNotLive, readNoteTombstone, setNote } from '../apps/acme';

describe('late join hydrates soft deleted tombstones', () => {
  test('peer that joins after delete gets tombstone from snapshot', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 511,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'gone' });
    await world.assertConverged();
    await a.mutate(deleteNote, { id: 'n1' });
    await world.assertConverged();

    const c = await world.addClient({ id: 'charlie' });
    await expectNoteNotLive(c.db, 'n1');
    const tomb = await readNoteTombstone(c.db, 'n1');
    expect(tomb).not.toBeNull();
  });
});
