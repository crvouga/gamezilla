import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  readLiveNotes,
  readNoteTombstone,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

const TOMBSTONE_COUNT = 120;

describe('tombstone accumulation still converges', () => {
  // README known limitation 1 SQLite growth — soft-delete catalogs accumulate.
  test('hundreds of tombstones; live queries stay correct and converge', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1040,
      faults: RELIABLE_FAULTS,
    });
    try {
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
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep modest tombstone piles converge', async () => {
    for (const seed of [1041, 1042, 1043] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
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
      } finally {
        await world.dispose();
      }
    }
  });
});
