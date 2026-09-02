import { describe, expect, test } from 'bun:test';
import { MAX_FANOUT_ROWS } from '@pkgs/sync-engine/shared';
import {
  expectLiveNote,
  expectNotesMatchServer,
  readLiveNotes,
  retouchNotes,
  setNote,
} from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

function noteIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `cap-${String(i).padStart(3, '0')}`
  );
}

describe('fanout row cap boundary 64 vs 65', () => {
  test('exactly MAX_FANOUT_ROWS applies via images while sync held', async () => {
    await using world = await openAcmeWorld({
      seed: 808,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    const ids = noteIds(MAX_FANOUT_ROWS);

    for (const id of ids) {
      await a.mutate(setNote, { id, body: 'seed' });
    }
    await world.assertConverged();

    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(retouchNotes, { ids, body: 'at-cap' });
      await world.advance(500);

      for (const id of ids) {
        await expectLiveNote(b.db, id, { body: 'at-cap' });
      }
    }
    await world.assertConverged();
    expect((await readLiveNotes(b.db)).length).toBe(MAX_FANOUT_ROWS);
    await expectNotesMatchServer(b.db, world.server.db);
  });

  test('MAX_FANOUT_ROWS+1 falls back to pushSeq-only; peers still converge', async () => {
    await using world = await openAcmeWorld({
      seed: 809,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    const ids = noteIds(MAX_FANOUT_ROWS + 1);

    for (const id of ids) {
      await a.mutate(setNote, { id, body: 'seed' });
    }
    await world.assertConverged();

    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(retouchNotes, { ids, body: 'over-cap' });
      await world.advance(200);
      // Over-cap omits images; peer waits for sync refetch.
    }
    await world.assertConverged();

    await expectLiveNote(b.db, ids[0]!, { body: 'over-cap' });
    await expectLiveNote(b.db, ids[MAX_FANOUT_ROWS]!, { body: 'over-cap' });
    expect((await readLiveNotes(b.db)).length).toBe(MAX_FANOUT_ROWS + 1);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
