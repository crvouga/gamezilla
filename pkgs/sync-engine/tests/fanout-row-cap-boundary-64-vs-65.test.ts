import { describe, expect, test } from 'bun:test';
import { MAX_FANOUT_ROWS } from '@pkgs/sync-engine/shared';
import {
  addClient,
  exampleSystem,
  expectInSync,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  net,
  retouchNotes,
  setNote,
} from '@pkgs/sync-engine/sim';

function noteIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `cap-${String(i).padStart(3, '0')}`
  );
}

describe('fanout row cap boundary 64 vs 65', () => {
  test('exactly MAX_FANOUT_ROWS applies via images while sync held', async () => {
    await using s = await exampleSystem.run({
      seed: 808,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    const ids = noteIds(MAX_FANOUT_ROWS);

    for (const id of ids) {
      await s.apply(mutate, 'alice', setNote, { id, body: 'seed' });
    }
    await expectInSync(s);

    await s.apply(net, 'bob', 'sync', 'hold');
    await s.apply(mutate, 'alice', retouchNotes, { ids, body: 'at-cap' });
    await s.advanceTime(500);

    for (const id of ids) {
      await expectLiveNoteAt(s, 'bob', id, { body: 'at-cap' });
    }

    await expectInSync(s);
    expect((await s.read(liveNotes, 'bob')).length).toBe(MAX_FANOUT_ROWS);
  });

  test('MAX_FANOUT_ROWS+1 falls back to pushSeq-only; peers still converge', async () => {
    await using s = await exampleSystem.run({
      seed: 809,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    const ids = noteIds(MAX_FANOUT_ROWS + 1);

    for (const id of ids) {
      await s.apply(mutate, 'alice', setNote, { id, body: 'seed' });
    }
    await expectInSync(s);

    await s.apply(net, 'bob', 'sync', 'hold');
    await s.apply(mutate, 'alice', retouchNotes, { ids, body: 'over-cap' });
    // Over-cap omits images; peer waits for sync refetch.
    await s.advanceTime(200);
    await expectInSync(s);

    await expectLiveNoteAt(s, 'bob', ids[0]!, { body: 'over-cap' });
    await expectLiveNoteAt(s, 'bob', ids[MAX_FANOUT_ROWS]!, {
      body: 'over-cap',
    });
    expect((await s.read(liveNotes, 'bob')).length).toBe(MAX_FANOUT_ROWS + 1);
  });
});
