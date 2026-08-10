import { describe, expect, test } from 'bun:test';
import { createSyncEnginePool } from '@pkgs/sync-engine/client';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('account switch pool isolation', () => {
  test('createSyncEnginePool switches identities without cross-DB bleed', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 950,
      rowImageFanout: false,
    });
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

    const engA = await pool.getOrCreate('user-a', async () =>
      acctA.getSyncEngine()
    );
    expect(engA).toBe(acctA.getSyncEngine());

    // Offline pending on A must not appear in B's separate local DB.
    await acctA.disconnect();
    await acctA.mutate(setNote, { id: 'a-pending', body: 'only-on-a' });
    await expectLiveNote(acctA.db, 'a-pending', { body: 'only-on-a' });
    await expectNoteNotLive(world.server.db, 'a-pending');

    const engB = await pool.getOrCreate('user-b', async () =>
      acctB.getSyncEngine()
    );
    expect(engB).toBe(acctB.getSyncEngine());
    expect(acctA.connection()).toBe('disconnected');
    await expectNoteNotLive(acctB.db, 'a-pending');

    await acctB.mutate(setNote, { id: 'b-only', body: 'from-b' });
    await world.runFor(200);
    await expectLiveNote(acctB.db, 'b-only', { body: 'from-b' });
    await expectNoteNotLive(acctA.db, 'b-only');

    const engA2 = await pool.getOrCreate('user-a', async () =>
      acctA.getSyncEngine()
    );
    expect(engA2).toBe(acctA.getSyncEngine());
    await expectLiveNote(acctA.db, 'a-pending', { body: 'only-on-a' });

    await acctA.connect();
    await acctB.connect();
    await world.assertConverged();
    await expectLiveNote(acctB.db, 'a-pending', { body: 'only-on-a' });
    await expectLiveNote(acctA.db, 'b-only', { body: 'from-b' });
  });

  test('concurrent getOrCreate for different identities does not overlap create', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 960,
      rowImageFanout: false,
    });
    const acctA = await world.addClient({
      id: 'device-a-race',
      actorId: 'user-a-race',
    });
    const acctB = await world.addClient({
      id: 'device-b-race',
      actorId: 'user-b-race',
    });
    const pool = createSyncEnginePool({
      globalKey: `sim-account-pool-race-${world.seed.toString(16)}`,
    });

    let overlappingCreates = 0;
    let inFlightCreates = 0;
    const slowCreate = async (
      getEngine: () => ReturnType<typeof acctA.getSyncEngine>
    ) => {
      inFlightCreates += 1;
      if (inFlightCreates > 1) overlappingCreates += 1;
      await world.runFor(50);
      inFlightCreates -= 1;
      return getEngine();
    };

    const [engA, engB] = await Promise.all([
      pool.getOrCreate('user-a-race', () =>
        slowCreate(() => acctA.getSyncEngine())
      ),
      pool.getOrCreate('user-b-race', () =>
        slowCreate(() => acctB.getSyncEngine())
      ),
    ]);

    expect(overlappingCreates).toBe(0);
    expect(engA).toBe(acctA.getSyncEngine());
    expect(engB).toBe(acctB.getSyncEngine());
    expect(acctA.connection()).toBe('disconnected');
  });

  test.each([951, 952, 953])(
    'seed sweep dual-client pool stand-in isolates pending (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        rowImageFanout: false,
      });
      const a = await world.addClient({ id: 'a', actorId: 'ua' });
      const b = await world.addClient({ id: 'b', actorId: 'ub' });
      const pool = createSyncEnginePool({
        globalKey: `sim-pool-${seed}`,
      });
      await pool.getOrCreate('ua', async () => a.getSyncEngine());
      await a.disconnect();
      await a.mutate(setNote, { id: `pend-${seed}`, body: 'a' });
      await pool.getOrCreate('ub', async () => b.getSyncEngine());
      await expectNoteNotLive(b.db, `pend-${seed}`);
      await a.connect();
      await b.connect();
      await world.assertConverged();
      await expectLiveNote(b.db, `pend-${seed}`, { body: 'a' });
    }
  );
});
