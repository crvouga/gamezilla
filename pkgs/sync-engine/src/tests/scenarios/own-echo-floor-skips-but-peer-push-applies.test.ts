import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('own echo floor skips but peer push applies', () => {
  test('mutator never flickers on own echo; peer still paints', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 805,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'seed' });
      await world.assertConverged();

      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'final' });

      for (let i = 0; i < 8; i += 1) {
        await world.runFor(25);
        const rows = await readLiveNotes(a.db);
        expect(rows.find((r) => r.id === 'n1')?.body).toBe('final');
      }

      await expectLiveNote(b.db, 'n1', { body: 'final' });
      world.release('bob', 'sync');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'final' });
    } finally {
      await world.dispose();
    }
  });
});
