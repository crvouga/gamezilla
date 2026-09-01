import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('own echo floor skips but peer push applies', () => {
  test('mutator never flickers on own echo; peer still paints', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 805,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
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
