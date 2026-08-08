import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, readLiveNotes, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('concurrent topic seq allocation monotonic', () => {
  test('overlapping mutates on shared topic converge without torn state', async () => {
    const world = await openSimWorld({ seed: 920, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      const writes: Promise<unknown>[] = [];
      for (let i = 0; i < 12; i += 1) {
        writes.push(
          a.mutate(setNote, {
            id: `a-${String(i).padStart(2, '0')}`,
            body: `a${i}`,
          })
        );
        writes.push(
          b.mutate(setNote, {
            id: `b-${String(i).padStart(2, '0')}`,
            body: `b${i}`,
          })
        );
        if (i % 3 === 0) await world.runFor(5);
      }
      await Promise.all(writes);
      await world.assertConverged();

      expect(await world.checkInvariants()).toBeNull();
      const server = await readLiveNotes(world.server.db);
      expect(server.length).toBe(24);
      await expectLiveNote(a.db, 'a-00', { body: 'a0' });
      await expectLiveNote(b.db, 'b-11', { body: 'b11' });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep concurrent writers converge', async () => {
    for (const seed of [921, 922, 923] as const) {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });
        await Promise.all([
          a.mutate(setNote, { id: `a-${seed}`, body: 'x' }),
          b.mutate(setNote, { id: `b-${seed}`, body: 'y' }),
        ]);
        await world.assertConverged();
        expect(await world.checkInvariants()).toBeNull();
      } finally {
        await world.dispose();
      }
    }
  });
});
