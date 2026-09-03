import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  expectLiveNoteAt,
  expectNotesAgree,
  liveNotes,
  mutate,
  net,
  nudge,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

const REORDERING_FAULTS = {
  ...RELIABLE_FAULTS,
  latencyMeanMs: 30,
  latencyJitterMs: 20,
  reorderWindow: 3,
} as const;

describe('push during inflight merge queues single flight', () => {
  test('pushes during merge leave no torn intermediate; final converge', async () => {
    await using run = await start(acmeSystem, {
      seed: 811,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(net, 'alice', 'all', REORDERING_FAULTS);
    await run.apply(net, 'bob', 'all', REORDERING_FAULTS);

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'seed' });
    await run.apply(converge);

    // nudge: force in-flight merge so pushes queue single-flight
    await run.apply(nudge, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'burst-1' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'burst-2' });
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'burst-final',
    });

    for (let i = 0; i < 12; i += 1) {
      await run.apply(passTime, 25);
      const rows = await run.observe(liveNotes('bob'));
      // Single-flight: never a torn mix where only one of the seeded pair is gone.
      expect(rows.length).toBeGreaterThanOrEqual(2);
    }

    await run.apply(converge);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'burst-final' });
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'burst-2' });
    await expectNotesAgree(run, 'bob');
  });
});
