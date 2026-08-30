import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('own echo floor skips but peer push applies', () => {
  test('mutator never flickers on own echo; peer still paints', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 805,
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
