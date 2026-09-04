import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  setNote,
} from '../apps/acme';

describe('online mutate no optimistic body flicker', () => {
  test('online mutate never reverts optimistic body before quiescence', async () => {
    await using s = await acmeSystem.script({
      seed: 700,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(s);

    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-final',
    });

    for (let i = 0; i < 8; i += 1) {
      await s.elapse(25);
      const notes = await s.observe(liveNotes, 'alice');
      expect(notes.find((r) => r.id === 'n1')?.body).toBe('optimistic-final');
    }

    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'optimistic-final' });
  });
});
