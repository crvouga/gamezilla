import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  readLiveNotes,
  readNoteTombstone,
  setNote,
} from '../apps/acme';

const TOMBSTONE_COUNT = 120;

describe('tombstone accumulation still converges', () => {
  // README known limitation 1 SQLite growth — soft-delete catalogs accumulate.
  test('hundreds of tombstones; live queries stay correct and converge', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 1040,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    for (let i = 0; i < TOMBSTONE_COUNT; i += 1) {
      const id = `t-${String(i).padStart(3, '0')}`;
      await a.mutate(setNote, { id, body: `b${i}` });
      await a.mutate(deleteNote, { id });
    }
    await a.mutate(setNote, { id: 'live-final', body: 'survivor' });
    await world.assertConverged();

    await expectLiveNote(b.db, 'live-final', { body: 'survivor' });
    const live = await readLiveNotes(b.db);
    expect(live.map((n) => n.id)).toEqual(['live-final']);
    expect(live[0]?.body).toBe('survivor');
    await expectNoteNotLive(b.db, 't-000');
    expect(await readNoteTombstone(b.db, 't-000')).not.toBeNull();
    expect(await readNoteTombstone(b.db, 't-119')).not.toBeNull();
  });

  test.each([1041, 1042, 1043])(
    'seed sweep modest tombstone piles converge (seed=%i)',
    async (seed) => {
      await using world = await openWorld({
        domain: acmeDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      for (let i = 0; i < 20; i += 1) {
        const id = `t-${seed}-${i}`;
        await a.mutate(setNote, { id, body: 'x' });
        await a.mutate(deleteNote, { id });
      }
      await a.mutate(setNote, { id: `live-${seed}`, body: 'ok' });
      await world.assertConverged();
      await expectLiveNote(world.server.db, `live-${seed}`, { body: 'ok' });
    }
  );
});
