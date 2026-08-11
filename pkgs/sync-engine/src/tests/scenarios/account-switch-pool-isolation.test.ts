import { describe, expect, test } from 'bun:test';
import { createSyncEnginePool } from '@pkgs/sync-engine/client';
import {
  expectLiveNote,
  expectNoteNotLive,
  isLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('account switch pool isolation', () => {
  test('createSyncEnginePool closes prior identity SQLite before next open', async () => {
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
    // Prior identity is dropped from the ready map after SQLite close (web OPFS
    // single-session). Switch-back must recreate via `create`.
    expect(pool.peekReady('user-a')).toBeNull();
    expect(pool.peekReady('user-b')).toBe(engB);
    await expectNoteNotLive(acctB.db, 'a-pending');

    await acctB.mutate(setNote, { id: 'b-only', body: 'from-b' });
    await acctB.connect();
    await world.until(() => isLiveNote(world.server.db, 'b-only'));
    await expectLiveNote(world.server.db, 'b-only', { body: 'from-b' });

    // Drop closed :memory: clients before the next pool activation.
    await world.node('device-a').crash();

    let recreated = 0;
    const nextA = await world.addClient({
      id: 'device-a-reopen',
      actorId: 'user-a',
    });
    const engA2 = await pool.getOrCreate('user-a', async () => {
      recreated += 1;
      return nextA.getSyncEngine();
    });
    expect(recreated).toBe(1);
    expect(engA2).toBe(nextA.getSyncEngine());
    expect(pool.peekReady('user-b')).toBeNull();
    // Fresh local DB for the reopened identity — prior :memory: handle is gone.
    await expectNoteNotLive(nextA.db, 'a-pending');

    await world.node('device-b').crash();
    await nextA.connect();
    await world.assertConverged();
    await expectLiveNote(nextA.db, 'b-only', { body: 'from-b' });
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
    expect(pool.peekReady('user-a-race')).toBeNull();
    expect(pool.peekReady('user-b-race')).toBe(engB);
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
      expect(pool.peekReady('ua')).toBeNull();
      await world.node('a').crash();
      await b.connect();
      const a2 = await world.addClient({ id: 'a2', actorId: 'ua' });
      await pool.getOrCreate('ua', async () => a2.getSyncEngine());
      await world.node('b').crash();
      await a2.mutate(setNote, { id: `pend-${seed}`, body: 'a' });
      await a2.connect();
      await world.until(() => isLiveNote(world.server.db, `pend-${seed}`));
      await expectLiveNote(world.server.db, `pend-${seed}`, { body: 'a' });
    }
  );
});
