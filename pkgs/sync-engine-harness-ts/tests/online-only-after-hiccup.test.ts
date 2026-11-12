import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import { createMutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import { mutationVerdict } from '@pkgs/sync-engine-client-ts/mutation-status';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';
import {
  requiresOnlineNote,
  setNote,
} from '@pkgs/sync-engine-harness-ts/mutations';
import { exampleMutationRegistry } from '@pkgs/sync-engine-harness-ts/registries';
import { createControllableLifecycle } from '@pkgs/sync-engine-shared-ts/app-lifecycle';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';

async function settle(): Promise<void> {
  for (let turn = 0; turn < 200; turn += 1) await Promise.resolve();
}

type Failure = () => Error;

/** A synced, online device whose next requests fail as `failures` say. */
async function openLiveDevice() {
  const db = SqlClientImplBunSqlite.openMemory();
  const time = createHarnessClock();
  const control = createControllableLifecycle({ online: true });
  const queryFailures: Failure[] = [];
  const uploadFailures: Failure[] = [];
  const { createId } = createHarnessIds('online-only-after-hiccup');
  const env = {
    actorId: 'alice',
    deviceId: 'device',
    accountId: 'alice',
    isAnon: false,
    now: () => new Date(time.clock.now()),
    createId,
  };
  const engine = await createLocalSyncEngine({
    db,
    localSchema: exampleLocalSchema,
    mutationRegistry: exampleMutationRegistry,
    getMutationEnv: () => env,
    getClientId: () => 'device',
    sessionQueries: [{ name: 'notes', params: {} }],
    postQueries: async (batch) => {
      const failure = queryFailures.shift();
      if (failure !== undefined) throw failure();
      return batch.map(() => ({ status: 'not_modified' as const }));
    },
    postMutations: async () => {
      const failure = uploadFailures.shift();
      throw (failure ?? (() => new HttpNetworkError('never answered')))();
    },
    isAuthRevoked: () => false,
    deleteDatabase: async () => undefined,
    now: time.clock.now,
    timers: time.timers,
    createId,
    lifecycle: control.lifecycle,
    reconcileIntervalMs: 0,
  });
  const client = createMutationClient({
    db: engine.db,
    registry: exampleMutationRegistry,
    env,
    ids: { clientId: 'device' },
    connectivity: { isOnline: () => engine.status.getSnapshot().online },
    createId,
  });
  await engine.connect();
  await engine.waitForFirstSync();
  await settle();
  expect(engine.status.getSnapshot().online).toBe(true);
  expect(engine.status.getSnapshot().hasSynced).toBe(true);
  return {
    engine,
    control,
    clock: time.clock,
    queryFailures,
    uploadFailures,
    announce: (id: string) =>
      client.mutate(requiresOnlineNote, { id, body: 'at noon' }),
    write: (id: string) => client.mutate(setNote, { id, body: 'draft' }),
    close: async () => {
      await client.drain();
      await engine.disconnect();
      await db.disconnect();
    },
  };
}

type LiveDevice = Awaited<ReturnType<typeof openLiveDevice>>;

async function withLiveDevice(
  run: (device: LiveDevice) => Promise<void>
): Promise<void> {
  const device = await openLiveDevice();
  try {
    await run(device);
  } finally {
    await device.close();
  }
}

function refusedOffline(result: Awaited<ReturnType<LiveDevice['announce']>>) {
  return (
    !result.ok && result.failures.some((failure) => failure.code === 'OFFLINE')
  );
}

// regression: sync-hiccup-refuses-online-only-actions
test('one failed refresh on a live connection does not refuse an online-only action', async () => {
  await withLiveDevice(async (device) => {
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    await device.engine.refreshQueries();
    await settle();
    expect(device.engine.status.getSnapshot().lastError).not.toBeNull();
    expect(device.engine.status.getSnapshot().online).toBe(true);
    expect((await device.announce('fire-drill')).ok).toBe(true);
  });
});

// regression: sync-hiccup-refuses-online-only-actions
test('a server error answering a refresh does not refuse an online-only action', async () => {
  await withLiveDevice(async (device) => {
    device.queryFailures.push(() => new Error('POST /api/query → 502'));
    device.queryFailures.push(() => new Error('POST /api/query → 502'));
    await device.engine.refreshQueries();
    await device.engine.refreshQueries();
    await settle();
    expect(device.engine.status.getSnapshot().online).toBe(true);
    expect((await device.announce('fire-drill')).ok).toBe(true);
  });
});

// regression: sync-hiccup-refuses-online-only-actions
test('one failed save on a live connection does not refuse an online-only action', async () => {
  await withLiveDevice(async (device) => {
    device.uploadFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    expect((await device.write('draft')).ok).toBe(true);
    await settle();
    expect(device.engine.status.getSnapshot().lastError).not.toBeNull();
    expect(device.engine.status.getSnapshot().online).toBe(true);
    expect((await device.announce('fire-drill')).ok).toBe(true);
  });
});

test('a device that goes offline still has online-only actions refused', async () => {
  await withLiveDevice(async (device) => {
    device.control.setOnline(false);
    expect(refusedOffline(await device.announce('fire-drill'))).toBe(true);
  });
});

test('a server that stays unreachable still has online-only actions refused', async () => {
  await withLiveDevice(async (device) => {
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    await device.engine.refreshQueries();
    await device.engine.refreshQueries();
    await settle();
    expect(device.engine.status.getSnapshot().online).toBe(false);
    expect(refusedOffline(await device.announce('fire-drill'))).toBe(true);
  });
});

// regression: online-only-action-accepted-in-hiccup-never-settles
test('an online-only action taken during a hiccup is refused once the connection proves lost', async () => {
  await withLiveDevice(async (device) => {
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    await device.engine.refreshQueries();
    await settle();
    expect(device.engine.status.getSnapshot().online).toBe(true);
    const taken = await device.announce('fire-drill');
    if (!taken.ok) throw new Error('the hiccup refused the announcement');
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    await device.engine.refreshQueries();
    await settle();
    expect(device.engine.status.getSnapshot().online).toBe(false);
    expect(await mutationVerdict(device.engine.db, taken.mutationId)).toEqual({
      status: 'rejected',
      code: 'OFFLINE',
      message: 'This action needs a connection.',
    });
  });
});

// regression: online-only-action-sent-before-trouble-refused
test('an online-only action taken before the trouble began keeps waiting for its verdict', async () => {
  await withLiveDevice(async (device) => {
    const taken = await device.announce('stop-adding-puzzles');
    if (!taken.ok) throw new Error('the live device refused the announcement');
    device.clock.advance(1_000);
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    await device.engine.refreshQueries();
    await device.engine.refreshQueries();
    await settle();
    expect(device.engine.status.getSnapshot().online).toBe(false);
    expect(await mutationVerdict(device.engine.db, taken.mutationId)).toEqual({
      status: 'pending',
    });
  });
});

test('a write that is not online-only stays queued when the connection proves lost', async () => {
  await withLiveDevice(async (device) => {
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    const taken = await device.write('draft');
    if (!taken.ok) throw new Error('the draft was refused');
    await device.engine.refreshQueries();
    await device.engine.refreshQueries();
    await settle();
    expect(device.engine.status.getSnapshot().online).toBe(false);
    expect(await mutationVerdict(device.engine.db, taken.mutationId)).toEqual({
      status: 'pending',
    });
  });
});

test('a reachable server again accepts online-only actions after an outage', async () => {
  await withLiveDevice(async (device) => {
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    device.queryFailures.push(() => new HttpNetworkError('net::ERR_FAILED'));
    await device.engine.refreshQueries();
    await device.engine.refreshQueries();
    await device.engine.refreshQueries();
    await settle();
    expect(device.engine.status.getSnapshot().online).toBe(true);
    expect(device.engine.status.getSnapshot().lastError).toBeNull();
    expect((await device.announce('fire-drill')).ok).toBe(true);
  });
});
