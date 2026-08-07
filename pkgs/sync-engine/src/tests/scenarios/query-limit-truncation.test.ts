import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, readLiveNotes, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('query limit truncation', () => {
  test('hard limit truncates hydrate; engine stays healthy and world converges', async () => {
    const world = await openSimWorld({ seed: 630, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });

      for (let i = 0; i < 12; i += 1) {
        await a.mutate(setNote, {
          id: `n${String(i).padStart(2, '0')}`,
          body: `b${i}`,
        });
      }
      await world.assertConverged();
      expect((await readLiveNotes(world.server.db)).length).toBe(12);

      const lim = await world.addClient({
        id: 'limited',
        sessionQuery: { name: 'notesLimited', params: {} },
      });
      const hydrated = await readLiveNotes(lim.db);
      expect(hydrated.length).toBeLessThanOrEqual(5);
      expect(hydrated.length).toBe(5);

      await a.mutate(setNote, { id: 'n99', body: 'after-limit' });
      // Limited peer cannot full-converge (missing rows by design).
      await world.crashClient('limited');
      await world.assertConverged();
      await expectLiveNote(a.db, 'n99', { body: 'after-limit' });
    } finally {
      await world.dispose();
    }
  });
});
