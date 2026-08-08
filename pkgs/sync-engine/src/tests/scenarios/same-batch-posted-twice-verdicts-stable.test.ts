import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, readLiveNotes, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('same batch posted twice verdicts stable', () => {
  for (const seed of [820, 821, 822]) {
    test(`mesh replay of mutations POST is idempotent (seed=${seed})`, async () => {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        world.setFaults('alice', 'sync', {
          ...RELIABLE_FAULTS,
          packetReplayProbability: 1,
        });

        await a.mutate(setNote, { id: 'n1', body: 'replay-safe' });
        await world.assertConverged();

        await expectLiveNote(b.db, 'n1', { body: 'replay-safe' });
        const server = await readLiveNotes(world.server.db);
        expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
      } finally {
        await world.dispose();
      }
    });
  }
});
