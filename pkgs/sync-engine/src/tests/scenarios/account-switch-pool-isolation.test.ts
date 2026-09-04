import { describe, expect, test } from 'bun:test';
import { createSyncEnginePool } from '@pkgs/sync-engine/client';
import {
  acmeSystem,
  addClient,
  connect,
  connection,
  crash,
  disconnect,
  liveNote,
  mutate,
  noteLive,
  poolActivate,
  poolActivateConcurrently,
  poolMatched,
  poolOverlappingCreates,
  setNote,
  untilAcme,
} from '../apps/acme';

describe('account switch pool isolation', () => {
  test('createSyncEnginePool closes prior identity SQLite before next open', async () => {
    await using s = await acmeSystem.script({
      seed: 950,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, { id: 'device-a', actorId: 'user-a' });
    await s.apply(addClient, { id: 'device-b', actorId: 'user-b' });

    const pool = createSyncEnginePool({ globalKey: 'sim-account-pool-950' });

    await s.apply(poolActivate, pool, {
      identity: 'user-a',
      clientId: 'device-a',
    });
    expect(await s.observe(poolMatched, 'user-a')).toBe(true);

    // Offline pending on A must not appear in B's separate local DB.
    await s.apply(disconnect, 'device-a');
    await s.apply(mutate, 'device-a', setNote, {
      id: 'a-pending',
      body: 'only-on-a',
    });
    expect(await s.observe(liveNote, 'device-a', 'a-pending')).toMatchObject({
      body: 'only-on-a',
    });
    expect(await s.observe(liveNote, 'server', 'a-pending')).toBeNull();

    await s.apply(poolActivate, pool, {
      identity: 'user-b',
      clientId: 'device-b',
    });
    expect(await s.observe(poolMatched, 'user-b')).toBe(true);
    expect(await s.observe(connection, 'device-a')).toBe('disconnected');
    // Prior identity is dropped from the ready map after SQLite close (web OPFS
    // single-session). Switch-back must recreate via `create`.
    expect(pool.peekReady('user-a')).toBeNull();
    expect(pool.peekReady('user-b')).not.toBeNull();
    expect(await s.observe(liveNote, 'device-b', 'a-pending')).toBeNull();

    await s.apply(mutate, 'device-b', setNote, {
      id: 'b-only',
      body: 'from-b',
    });
    await s.apply(connect, 'device-b');
    await untilAcme(s, (s) => liveNote(s, 'server', 'b-only'), {
      pred: noteLive,
    });
    expect(await s.observe(liveNote, 'server', 'b-only')).toMatchObject({
      body: 'from-b',
    });

    // Drop closed :memory: clients before the next pool activation.
    await s.apply(crash, 'device-a');
    await s.apply(crash, 'device-b');

    await s.apply(addClient, { id: 'device-a-reopen', actorId: 'user-a' });
    await s.apply(poolActivate, pool, {
      identity: 'user-a',
      clientId: 'device-a-reopen',
    });
    expect(await s.observe(poolMatched, 'user-a')).toBe(true);
    expect(pool.peekReady('user-b')).toBeNull();
    // Fresh local DB for the reopened identity — prior :memory: handle is gone.
    expect(
      await s.observe(liveNote, 'device-a-reopen', 'a-pending')
    ).toBeNull();

    await s.elapse(300);
    expect(
      await s.observe(liveNote, 'device-a-reopen', 'b-only')
    ).toMatchObject({ body: 'from-b' });
  });

  test('concurrent getOrCreate for different identities does not overlap create', async () => {
    await using s = await acmeSystem.script({
      seed: 960,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, {
      id: 'device-a-race',
      actorId: 'user-a-race',
    });
    await s.apply(addClient, {
      id: 'device-b-race',
      actorId: 'user-b-race',
    });
    const pool = createSyncEnginePool({
      globalKey: 'sim-account-pool-race-960',
    });

    await s.apply(
      poolActivateConcurrently,
      pool,
      [
        { identity: 'user-a-race', clientId: 'device-a-race' },
        { identity: 'user-b-race', clientId: 'device-b-race' },
      ],
      50
    );

    expect(await s.observe(poolOverlappingCreates)).toBe(0);
    expect(await s.observe(poolMatched, 'user-a-race')).toBe(true);
    expect(await s.observe(poolMatched, 'user-b-race')).toBe(true);
    expect(await s.observe(connection, 'device-a-race')).toBe('disconnected');
    expect(pool.peekReady('user-a-race')).toBeNull();
    expect(pool.peekReady('user-b-race')).not.toBeNull();
  });

  test.each([951, 952, 953])(
    'seed sweep dual-client pool stand-in isolates pending (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0, rowImageFanout: false },
      });

      await s.apply(addClient, { id: 'a', actorId: 'ua' });
      await s.apply(addClient, { id: 'b', actorId: 'ub' });
      const pool = createSyncEnginePool({ globalKey: `sim-pool-${seed}` });

      await s.apply(poolActivate, pool, { identity: 'ua', clientId: 'a' });
      await s.apply(disconnect, 'a');
      await s.apply(mutate, 'a', setNote, { id: `pend-${seed}`, body: 'a' });
      await s.apply(poolActivate, pool, { identity: 'ub', clientId: 'b' });
      expect(await s.observe(liveNote, 'b', `pend-${seed}`)).toBeNull();
      expect(pool.peekReady('ua')).toBeNull();
      await s.apply(crash, 'a');
      await s.apply(crash, 'b');
      await s.apply(addClient, { id: 'a2', actorId: 'ua' });
      await s.apply(poolActivate, pool, { identity: 'ua', clientId: 'a2' });
      await s.apply(mutate, 'a2', setNote, { id: `pend-${seed}`, body: 'a' });
      await s.apply(connect, 'a2');
      await s.elapse(1_000);
      expect(await s.observe(liveNote, 'server', `pend-${seed}`)).toMatchObject(
        { body: 'a' }
      );
    }
  );
});
