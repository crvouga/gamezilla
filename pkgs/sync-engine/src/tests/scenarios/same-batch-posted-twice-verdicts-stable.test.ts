import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('same batch posted twice verdicts stable', () => {
  test.each([820, 821, 822])(
    'mesh replay of mutations POST is idempotent (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
      });
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
