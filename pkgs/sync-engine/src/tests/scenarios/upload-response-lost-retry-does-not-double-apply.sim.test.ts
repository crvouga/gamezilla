import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('upload response lost retry does not double apply', () => {
  test.each([810, 811, 812])(
    'dropMutationsResponse still one row (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = host.facade;
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      using _fault = world.node('alice').httpFault({
        kind: 'dropMutationsResponse',
      });
      await a.mutate(setNote, { id: 'n1', body: 'once' });
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'once' });
      const server = await readLiveNotes(world.server.db);
      expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    }
  );
});
