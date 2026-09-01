import { describe, expect, test } from 'bun:test';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { openWorld } from '@pkgs/determinism';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';

describe('same batch posted twice verdicts stable', () => {
  test.each([820, 821, 822])(
    'mesh replay of mutations POST is idempotent (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.system);
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      using _faults = world.net('alice', 'sync').set({
        ...RELIABLE_FAULTS,
        packetReplayProbability: 1,
      });

      await a.mutate(setNote, { id: 'n1', body: 'replay-safe' });
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'replay-safe' });
      const server = await readLiveNotes(world.server.db);
      expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    }
  );
});
