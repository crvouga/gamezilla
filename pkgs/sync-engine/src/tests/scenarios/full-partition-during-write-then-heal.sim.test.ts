import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('full partition during write then heal', () => {
  test('partition then heal converges domain state', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 33,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _pa = world.net('alice').set('down');
      using _pb = world.net('bob').set('down');
      await a.mutate(setNote, { id: 'n1', body: 'during-partition' });
      await world.runFor(100);
    }
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'during-partition' });
  });
});
