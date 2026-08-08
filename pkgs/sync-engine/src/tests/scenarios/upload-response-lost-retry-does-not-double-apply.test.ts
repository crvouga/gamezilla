import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, readLiveNotes, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('upload response lost retry does not double apply', () => {
  for (const seed of [810, 811, 812]) {
    test(`dropMutationsResponse still one row (seed=${seed})`, async () => {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        world.armHttpFault('alice', { kind: 'dropMutationsResponse' });
        await a.mutate(setNote, { id: 'n1', body: 'once' });
        await world.assertConverged();

        await expectLiveNote(b.db, 'n1', { body: 'once' });
        const server = await readLiveNotes(world.server.db);
        expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
      } finally {
        await world.dispose();
      }
    });
  }
});
