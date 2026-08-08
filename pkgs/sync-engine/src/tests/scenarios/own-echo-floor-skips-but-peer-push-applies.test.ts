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
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 805,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'seed' });
    await world.assertConverged();

    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n1', body: 'final' });

      for (let i = 0; i < 8; i += 1) {
        await world.runFor(25);
        const rows = await readLiveNotes(a.db);
        expect(rows.find((r) => r.id === 'n1')?.body).toBe('final');
      }

      await expectLiveNote(b.db, 'n1', { body: 'final' });
    }
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'final' });
  });
});
