import { describe, expect, test } from 'bun:test';
import { createSyncEnginePool } from '@pkgs/sync-engine/client';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('account switch pool isolation', () => {
  test('createSyncEnginePool switches identities without cross-DB bleed', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 950,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const acctA = await world.addClient({
        id: 'device-a',
        actorId: 'user-a',
      });
      const acctB = await world.addClient({
        id: 'device-b',
        actorId: 'user-b',
      });

      const pool = createSyncEnginePool({
        globalKey: `sim-account-pool-${world.seed.toString(16)}`,
      });

      const engA = await pool.getOrCreate('user-a', async () => acctA.engine);
      expect(engA).toBe(acctA.engine);

      // Offline pending on A must not appear in B's separate local DB.
      await acctA.engine.disconnect();
      await acctA.mutate(setNote, { id: 'a-pending', body: 'only-on-a' });
      await expectLiveNote(acctA.db, 'a-pending', { body: 'only-on-a' });
      await expectNoteNotLive(world.server.db, 'a-pending');

      const engB = await pool.getOrCreate('user-b', async () => acctB.engine);
      expect(engB).toBe(acctB.engine);
      expect(acctA.engine.status.getSnapshot().connection).toBe('disconnected');
      await expectNoteNotLive(acctB.db, 'a-pending');

      await acctB.mutate(setNote, { id: 'b-only', body: 'from-b' });
      await world.runFor(200);
      await expectLiveNote(acctB.db, 'b-only', { body: 'from-b' });
      await expectNoteNotLive(acctA.db, 'b-only');

      const engA2 = await pool.getOrCreate('user-a', async () => acctA.engine);
      expect(engA2).toBe(acctA.engine);
      await expectLiveNote(acctA.db, 'a-pending', { body: 'only-on-a' });

      await acctA.engine.connect();
      await acctB.engine.connect();
      acctA.engine.wakeUploads();
      await world.assertConverged();
      await expectLiveNote(acctB.db, 'a-pending', { body: 'only-on-a' });
      await expectLiveNote(acctA.db, 'b-only', { body: 'from-b' });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep dual-client pool stand-in isolates pending', async () => {
    for (const seed of [951, 952, 953] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        const a = await world.addClient({ id: 'a', actorId: 'ua' });
        const b = await world.addClient({ id: 'b', actorId: 'ub' });
        const pool = createSyncEnginePool({
          globalKey: `sim-pool-${seed}`,
        });
        await pool.getOrCreate('ua', async () => a.engine);
        await a.engine.disconnect();
        await a.mutate(setNote, { id: `pend-${seed}`, body: 'a' });
        await pool.getOrCreate('ub', async () => b.engine);
        await expectNoteNotLive(b.db, `pend-${seed}`);
        await a.engine.connect();
        await b.engine.connect();
        a.engine.wakeUploads();
        await world.assertConverged();
        await expectLiveNote(b.db, `pend-${seed}`, { body: 'a' });
      } finally {
        await world.dispose();
      }
    }
  });
});
