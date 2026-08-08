import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

const STORM = 150;

describe('mutation storm batching order preserved', () => {
  test('offline queue drains; last-write-wins body matches seq order', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1060,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.engine.disconnect();
      // Many updates to the same id — final body must be last mutate.
      for (let i = 0; i < STORM; i += 1) {
        await a.mutate(setNote, {
          id: 'storm-shared',
          body: `v${i}`,
        });
      }
      // Distinct ids preserve create order / full set.
      for (let i = 0; i < 40; i += 1) {
        await a.mutate(setNote, {
          id: `row-${String(i).padStart(3, '0')}`,
          body: `r${i}`,
        });
      }

      await a.engine.connect();
      a.engine.wakeUploads();
      await world.assertConverged();

      await expectLiveNote(b.db, 'storm-shared', { body: `v${STORM - 1}` });
      await expectLiveNote(world.server.db, 'storm-shared', {
        body: `v${STORM - 1}`,
      });
      const server = await readLiveNotes(world.server.db);
      expect(server.some((n) => n.id === 'row-000')).toBe(true);
      expect(server.some((n) => n.id === 'row-039')).toBe(true);
      await expectLiveNote(b.db, 'row-039', { body: 'r39' });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep modest storm preserves final body', async () => {
    for (const seed of [1061, 1062, 1063] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        await world.addClient({ id: 'bob' });
        await a.engine.disconnect();
        for (let i = 0; i < 30; i += 1) {
          await a.mutate(setNote, { id: `s-${seed}`, body: `v${i}` });
        }
        await a.engine.connect();
        a.engine.wakeUploads();
        await world.assertConverged();
        await expectLiveNote(world.server.db, `s-${seed}`, { body: 'v29' });
      } finally {
        await world.dispose();
      }
    }
  });
});
