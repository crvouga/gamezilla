import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('sync partitioned while live delivers', () => {
  test('partition sync then heal converges', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 506,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _down = world.net('bob', 'sync').set('down');
      await a.mutate(setNote, { id: 'n1', body: 'sync-partitioned' });
      await world.runFor(100);
    }
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'sync-partitioned' });
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
