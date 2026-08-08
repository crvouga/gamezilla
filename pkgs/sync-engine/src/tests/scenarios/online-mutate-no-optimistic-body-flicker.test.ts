import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('online mutate no optimistic body flicker', () => {
  test('online mutate never reverts optimistic body before quiescence', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 700,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'seed' });
    await world.assertConverged();

    await a.mutate(setNote, { id: 'n1', body: 'optimistic-final' });

    for (let i = 0; i < 8; i += 1) {
      await world.runFor(25);
      const rows = await readLiveNotes(a.db);
      const note = rows.find((r) => r.id === 'n1');
      expect(note?.body).toBe('optimistic-final');
    }

    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'optimistic-final' });
  });
});
