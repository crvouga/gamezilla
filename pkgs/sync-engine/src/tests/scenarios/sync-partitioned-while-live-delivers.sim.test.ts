import { describe, test } from 'bun:test';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('sync partitioned while live delivers', () => {
  test('partition sync then heal converges', async () => {
    await using world = await openAcmeWorld({
      seed: 506,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _down = world.net('bob', 'sync').set('down');
      await a.mutate(setNote, { id: 'n1', body: 'sync-partitioned' });
      await world.advance(100);
    }
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'sync-partitioned' });
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
