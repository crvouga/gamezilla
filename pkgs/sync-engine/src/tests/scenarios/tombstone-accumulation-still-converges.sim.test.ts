import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  deleteNote,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  liveNotes,
  mutate,
  passTime,
  readNoteTombstoneAt,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

const TOMBSTONE_COUNT = 120;

describe('tombstone accumulation still converges', () => {
  // README known limitation 1 SQLite growth — soft-delete catalogs accumulate.
  test('hundreds of tombstones; live queries stay correct and converge', async () => {
    await using run = await start(acmeSystem, {
      seed: 1040,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    for (let i = 0; i < TOMBSTONE_COUNT; i += 1) {
      const id = `t-${String(i).padStart(3, '0')}`;
      await run.apply(mutate, 'alice', setNote, { id, body: `b${i}` });
      await run.apply(mutate, 'alice', deleteNote, { id });
    }
    await run.apply(mutate, 'alice', setNote, {
      id: 'live-final',
      body: 'survivor',
    });
    await run.apply(passTime, 5_000);
    await run.apply(converge);

    await expectLiveNoteAt(run, 'bob', 'live-final', { body: 'survivor' });
    const live = await run.observe(liveNotes('bob'));
    expect(live.map((n) => n.id)).toEqual(['live-final']);
    expect(live[0]?.body).toBe('survivor');
    await expectNoteNotLiveAt(run, 'bob', 't-000');
    expect(await readNoteTombstoneAt(run, 'bob', 't-000')).not.toBeNull();
    expect(await readNoteTombstoneAt(run, 'bob', 't-119')).not.toBeNull();
  });

  test.each([1041, 1042, 1043])(
    'seed sweep modest tombstone piles converge (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });
      for (let i = 0; i < 20; i += 1) {
        const id = `t-${seed}-${i}`;
        await run.apply(mutate, 'alice', setNote, { id, body: 'x' });
        await run.apply(mutate, 'alice', deleteNote, { id });
      }
      await run.apply(mutate, 'alice', setNote, {
        id: `live-${seed}`,
        body: 'ok',
      });
      await run.apply(passTime, 1_000);
      await run.apply(converge);
      await expectLiveNoteAt(run, 'server', `live-${seed}`, { body: 'ok' });
    }
  );
});
