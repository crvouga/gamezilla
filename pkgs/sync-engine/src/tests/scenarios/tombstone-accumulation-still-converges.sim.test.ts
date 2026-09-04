import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  deleteNote,
  expectConverged,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  liveNotes,
  mutate,
  readNoteTombstoneAt,
  setNote,
} from '../apps/acme';

const TOMBSTONE_COUNT = 120;

describe('tombstone accumulation still converges', () => {
  // README known limitation 1 SQLite growth — soft-delete catalogs accumulate.
  test('hundreds of tombstones; live queries stay correct and converge', async () => {
    await using s = await acmeSystem.script({
      seed: 1040,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    for (let i = 0; i < TOMBSTONE_COUNT; i += 1) {
      const id = `t-${String(i).padStart(3, '0')}`;
      await s.apply(mutate, 'alice', setNote, { id, body: `b${i}` });
      await s.apply(mutate, 'alice', deleteNote, { id });
    }
    await s.apply(mutate, 'alice', setNote, {
      id: 'live-final',
      body: 'survivor',
    });
    await s.elapse(5_000);
    await expectConverged(s);

    await expectLiveNoteAt(s, 'bob', 'live-final', { body: 'survivor' });
    const live = await s.observe(liveNotes, 'bob');
    expect(live.map((n) => n.id)).toEqual(['live-final']);
    expect(live[0]?.body).toBe('survivor');
    await expectNoteNotLiveAt(s, 'bob', 't-000');
    expect(await readNoteTombstoneAt(s, 'bob', 't-000')).not.toBeNull();
    expect(await readNoteTombstoneAt(s, 'bob', 't-119')).not.toBeNull();
  });

  test.each([1041, 1042, 1043])(
    'seed sweep modest tombstone piles converge (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });
      for (let i = 0; i < 20; i += 1) {
        const id = `t-${seed}-${i}`;
        await s.apply(mutate, 'alice', setNote, { id, body: 'x' });
        await s.apply(mutate, 'alice', deleteNote, { id });
      }
      await s.apply(mutate, 'alice', setNote, {
        id: `live-${seed}`,
        body: 'ok',
      });
      await s.elapse(1_000);
      await expectConverged(s);
      await expectLiveNoteAt(s, 'server', `live-${seed}`, { body: 'ok' });
    }
  );
});
