import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('upload response lost retry does not double apply', () => {
  test.each([810, 811, 812])(
    'dropMutationsResponse still one row (seed=%i)',
    async (seed) => {
      await using world = await openWorld({
        domain: acmeDomainPack,
        seed,
      });
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
