import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  hold,
  mutate,
  release,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt, liveNotes } from '../apps/acme/reads';

describe('own echo floor skips but peer push applies', () => {
  test('mutator never flickers on own echo; peer still paints', async () => {
    await using s = await acmeSystem.script({
      seed: 805,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(s);

    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'final' });

    for (let i = 0; i < 8; i += 1) {
      await s.elapse(25);
      const notes = await s.observe(liveNotes, 'alice');
      expect(notes.find((r) => r.id === 'n1')?.body).toBe('final');
    }

    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'final' });

    await s.apply(release, 'bob', 'sync');
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'final' });
  });
});
