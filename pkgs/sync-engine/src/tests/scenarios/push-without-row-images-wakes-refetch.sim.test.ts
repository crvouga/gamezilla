import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, setNoteNoFanout } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('push without row images wakes refetch', () => {
  test('mutation without capture images converges via wake+refetch with rowImageFanout', async () => {
    // rowImageFanout true: proves pushSeq-only pushes still wake peers when images absent.
    await using host = await openWorld(acmeSystem, {
      seed: 680,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNoteNoFanout, { id: 'n1', body: 'no-images' });
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'no-images' });
  });
});
