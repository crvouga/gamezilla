import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';
import { createControllableLifecycle } from '@pkgs/sync-engine-shared-ts/app-lifecycle';

test('connectivity status follows offline events without needing a failed request', async () => {
  // regression: sync-connectivity-status-stays-online
  const db = SqlClientImplBunSqlite.openMemory();
  const time = createHarnessClock();
  const control = createControllableLifecycle({ online: false });
  const engine = await createLocalSyncEngine({
    db,
    localSchema: exampleLocalSchema,
    mutationRegistry: {},
    getMutationEnv: () => ({
      actorId: 'alice',
      deviceId: 'device',
      accountId: 'alice',
      isAnon: false,
      now: () => new Date(time.clock.now()),
      createId: () => 'id',
    }),
    getClientId: () => 'device',
    sessionQueries: [{ name: 'notes', params: {} }],
    postQueries: async (requests) =>
      requests.map(() => ({ status: 'not_modified' as const })),
    postMutations: async () => ({
      ok: true,
      serverTimeMs: 0,
      verdicts: [],
      ackSeq: 0,
    }),
    isAuthRevoked: () => false,
    deleteDatabase: async () => undefined,
    now: time.clock.now,
    timers: time.timers,
    createId: () => 'id',
    lifecycle: control.lifecycle,
    reconcileIntervalMs: 0,
    enableMutationUpload: false,
  });
  try {
    expect(engine.status.getSnapshot().online).toBe(false);
    control.setOnline(true);
    await engine.connect();
    await engine.refreshQueries();
    expect(engine.status.getSnapshot().online).toBe(true);
    control.setOnline(false);
    expect(engine.status.getSnapshot().online).toBe(false);
    control.setOnline(true);
    expect(engine.status.getSnapshot().online).toBe(true);
    await engine.disconnect();
    control.setOnline(false);
    await engine.connect();
    expect(engine.status.getSnapshot().online).toBe(false);
  } finally {
    await engine.disconnect();
    await db.disconnect();
  }
});
