import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('content reverts hash matches not modified sound', () => {
  test('A→B→A while peer partitioned leaves peer at A after heal', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 803,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'A' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'A' });

    // Full partition so peer never applies intermediate B via live images.
    {
      using _part = world.net('bob').set('down');
      await a.mutate(setNote, { id: 'n1', body: 'B' });
      await a.mutate(setNote, { id: 'n1', body: 'A' });
      await world.runFor(100);
      await expectLiveNote(b.db, 'n1', { body: 'A' });
    }
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'A' });
    await expectLiveNote(a.db, 'n1', { body: 'A' });
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
