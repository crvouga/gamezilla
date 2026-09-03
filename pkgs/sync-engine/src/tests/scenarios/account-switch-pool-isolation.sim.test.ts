import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { createSyncEnginePool } from '@pkgs/sync-engine/client';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  connect,
  connection,
  crash,
  disconnect,
  liveNote,
  mutate,
  noteLive,
  passTime,
  poolActivate,
  poolActivateConcurrently,
  poolMatched,
  poolOverlappingCreates,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('account switch pool isolation', () => {
  test('createSyncEnginePool closes prior identity SQLite before next open', async () => {
    await using run = await start(acmeSystem, {
      seed: 950,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, { id: 'device-a', actorId: 'user-a' });
    await run.apply(addClient, { id: 'device-b', actorId: 'user-b' });

    const pool = createSyncEnginePool({ globalKey: 'sim-account-pool-950' });

    await run.apply(poolActivate, pool, {
      identity: 'user-a',
      clientId: 'device-a',
    });
    expect(await run.observe(poolMatched('user-a'))).toBe(true);

    // Offline pending on A must not appear in B's separate local DB.
    await run.apply(disconnect, 'device-a');
    await run.apply(mutate, 'device-a', setNote, {
      id: 'a-pending',
      body: 'only-on-a',
    });
    expect(await run.observe(liveNote('device-a', 'a-pending'))).toMatchObject({
      body: 'only-on-a',
    });
    expect(await run.observe(liveNote('server', 'a-pending'))).toBeNull();

    await run.apply(poolActivate, pool, {
      identity: 'user-b',
      clientId: 'device-b',
    });
    expect(await run.observe(poolMatched('user-b'))).toBe(true);
    expect(await run.observe(connection('device-a'))).toBe('disconnected');
    // Prior identity is dropped from the ready map after SQLite close (web OPFS
    // single-session). Switch-back must recreate via `create`.
    expect(pool.peekReady('user-a')).toBeNull();
    expect(pool.peekReady('user-b')).not.toBeNull();
    expect(await run.observe(liveNote('device-b', 'a-pending'))).toBeNull();

    await run.apply(mutate, 'device-b', setNote, {
      id: 'b-only',
      body: 'from-b',
    });
    await run.apply(connect, 'device-b');
    await untilAcme(run, liveNote('server', 'b-only'), { pred: noteLive });
    expect(await run.observe(liveNote('server', 'b-only'))).toMatchObject({
      body: 'from-b',
    });

    // Drop closed :memory: clients before the next pool activation.
    await run.apply(crash, 'device-a');
    await run.apply(crash, 'device-b');

    await run.apply(addClient, { id: 'device-a-reopen', actorId: 'user-a' });
    await run.apply(poolActivate, pool, {
      identity: 'user-a',
      clientId: 'device-a-reopen',
    });
    expect(await run.observe(poolMatched('user-a'))).toBe(true);
    expect(pool.peekReady('user-b')).toBeNull();
    // Fresh local DB for the reopened identity — prior :memory: handle is gone.
    expect(
      await run.observe(liveNote('device-a-reopen', 'a-pending'))
    ).toBeNull();

    await run.apply(passTime, 300);
    expect(
      await run.observe(liveNote('device-a-reopen', 'b-only'))
    ).toMatchObject({ body: 'from-b' });
  });

  test('concurrent getOrCreate for different identities does not overlap create', async () => {
    await using run = await start(acmeSystem, {
      seed: 960,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'device-a-race',
      actorId: 'user-a-race',
    });
    await run.apply(addClient, {
      id: 'device-b-race',
      actorId: 'user-b-race',
    });
    const pool = createSyncEnginePool({
      globalKey: 'sim-account-pool-race-960',
    });

    await run.apply(
      poolActivateConcurrently,
      pool,
      [
        { identity: 'user-a-race', clientId: 'device-a-race' },
        { identity: 'user-b-race', clientId: 'device-b-race' },
      ],
      50
    );

    expect(await run.observe(poolOverlappingCreates)).toBe(0);
    expect(await run.observe(poolMatched('user-a-race'))).toBe(true);
    expect(await run.observe(poolMatched('user-b-race'))).toBe(true);
    expect(await run.observe(connection('device-a-race'))).toBe('disconnected');
    expect(pool.peekReady('user-a-race')).toBeNull();
    expect(pool.peekReady('user-b-race')).not.toBeNull();
  });

  test.each([951, 952, 953])(
    'seed sweep dual-client pool stand-in isolates pending (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
        properties: [],
      });

      await run.apply(addClient, { id: 'a', actorId: 'ua' });
      await run.apply(addClient, { id: 'b', actorId: 'ub' });
      const pool = createSyncEnginePool({ globalKey: `sim-pool-${seed}` });

      await run.apply(poolActivate, pool, { identity: 'ua', clientId: 'a' });
      await run.apply(disconnect, 'a');
      await run.apply(mutate, 'a', setNote, { id: `pend-${seed}`, body: 'a' });
      await run.apply(poolActivate, pool, { identity: 'ub', clientId: 'b' });
      expect(await run.observe(liveNote('b', `pend-${seed}`))).toBeNull();
      expect(pool.peekReady('ua')).toBeNull();
      await run.apply(crash, 'a');
      await run.apply(crash, 'b');
      await run.apply(addClient, { id: 'a2', actorId: 'ua' });
      await run.apply(poolActivate, pool, { identity: 'ua', clientId: 'a2' });
      await run.apply(mutate, 'a2', setNote, { id: `pend-${seed}`, body: 'a' });
      await run.apply(connect, 'a2');
      await run.apply(passTime, 1_000);
      expect(
        await run.observe(liveNote('server', `pend-${seed}`))
      ).toMatchObject({ body: 'a' });
    }
  );
});
