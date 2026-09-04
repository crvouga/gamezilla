import { describe, expect, test } from 'bun:test';
import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  expectNotesAgree,
  liveNotes,
  mutate,
  net,
  nudge,
  setNote,
} from '../apps/acme';

const REORDERING_FAULTS = {
  ...RELIABLE_FAULTS,
  latencyMeanMs: 30,
  latencyJitterMs: 20,
  reorderWindow: 3,
} as const;

describe('push during inflight merge queues single flight', () => {
  test('pushes during merge leave no torn intermediate; final converge', async () => {
    await using s = await acmeSystem.script({
      seed: 811,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(net, 'alice', 'all', REORDERING_FAULTS);
    await s.apply(net, 'bob', 'all', REORDERING_FAULTS);

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'seed' });
    await expectConverged(s);

    // nudge: force in-flight merge so pushes queue single-flight
    await s.apply(nudge, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'burst-1' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'burst-2' });
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'burst-final',
    });

    for (let i = 0; i < 12; i += 1) {
      await s.elapse(25);
      const rows = await s.observe(liveNotes, 'bob');
      // Single-flight: never a torn mix where only one of the seeded pair is gone.
      expect(rows.length).toBeGreaterThanOrEqual(2);
    }

    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'burst-final' });
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'burst-2' });
    await expectNotesAgree(s, 'bob');
  });
});
