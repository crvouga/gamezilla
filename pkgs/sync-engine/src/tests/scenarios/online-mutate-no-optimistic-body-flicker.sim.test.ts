import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('online mutate no optimistic body flicker', () => {
  test('online mutate never reverts optimistic body before quiescence', async () => {
    await using run = await start(acmeSystem, {
      seed: 700,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(run);

    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-final',
    });

    for (let i = 0; i < 8; i += 1) {
      await run.apply(passTime, 25);
      const notes = await run.observe(liveNotes('alice'));
      expect(notes.find((r) => r.id === 'n1')?.body).toBe('optimistic-final');
    }

    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'optimistic-final' });
  });
});
