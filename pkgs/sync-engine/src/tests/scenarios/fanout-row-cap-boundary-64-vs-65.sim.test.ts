import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { MAX_FANOUT_ROWS } from '@pkgs/sync-engine/shared';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  net,
  passTime,
  retouchNotes,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

function noteIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `cap-${String(i).padStart(3, '0')}`
  );
}

describe('fanout row cap boundary 64 vs 65', () => {
  test('exactly MAX_FANOUT_ROWS applies via images while sync held', async () => {
    await using run = await start(acmeSystem, {
      seed: 808,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    const ids = noteIds(MAX_FANOUT_ROWS);

    for (const id of ids) {
      await run.apply(mutate, 'alice', setNote, { id, body: 'seed' });
    }
    await run.apply(converge);

    await run.apply(net, 'bob', 'sync', 'hold');
    await run.apply(mutate, 'alice', retouchNotes, { ids, body: 'at-cap' });
    await run.apply(passTime, 500);

    for (const id of ids) {
      await expectLiveNoteAt(run, 'bob', id, { body: 'at-cap' });
    }

    await run.apply(converge);
    expect((await run.observe(liveNotes('bob'))).length).toBe(MAX_FANOUT_ROWS);
  });

  test('MAX_FANOUT_ROWS+1 falls back to pushSeq-only; peers still converge', async () => {
    await using run = await start(acmeSystem, {
      seed: 809,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    const ids = noteIds(MAX_FANOUT_ROWS + 1);

    for (const id of ids) {
      await run.apply(mutate, 'alice', setNote, { id, body: 'seed' });
    }
    await run.apply(converge);

    await run.apply(net, 'bob', 'sync', 'hold');
    await run.apply(mutate, 'alice', retouchNotes, { ids, body: 'over-cap' });
    // Over-cap omits images; peer waits for sync refetch.
    await run.apply(passTime, 200);
    await run.apply(converge);

    await expectLiveNoteAt(run, 'bob', ids[0]!, { body: 'over-cap' });
    await expectLiveNoteAt(run, 'bob', ids[MAX_FANOUT_ROWS]!, {
      body: 'over-cap',
    });
    expect((await run.observe(liveNotes('bob'))).length).toBe(
      MAX_FANOUT_ROWS + 1
    );
  });
});
