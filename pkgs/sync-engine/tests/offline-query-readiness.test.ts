import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock';
import { HttpNetworkError } from '@pkgs/http-client';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createLocalSyncEngine } from '@pkgs/sync-engine/client';
import { exampleLocalSchema } from '@pkgs/sync-engine/harness';

// regression: offline-lookups-pretend-answered
test('offline startup settles but an unanswered lookup stays pending until reconnect', async () => {
  const raw = new Database(':memory:');
  const db = new SqlClientImplBunSqlite(raw);
  const time = createHarnessClock();
  let reachable = false;
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
    postQueries: async (requests) => {
      if (!reachable) throw new HttpNetworkError('offline');
      return requests.map(() => ({ status: 'not_modified' as const }));
    },
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
    reconcileIntervalMs: 0,
    enableMutationUpload: false,
  });
  const query = engine.subscribeQuery('notes', { title: 'bob' });
  let answered = false;
  void query.waitForFirstSync().then(() => {
    answered = true;
  });
  try {
    await engine.connect();
    await engine.refreshQueries();
    await engine.waitForFirstSync();
    expect(engine.status.getSnapshot().online).toBe(false);
    expect(answered).toBe(false);
    reachable = true;
    await engine.refreshQueries();
    await query.waitForFirstSync();
    expect(answered).toBe(true);
    expect(engine.status.getSnapshot().online).toBe(true);
  } finally {
    query.unsubscribe();
    await engine.disconnect();
    raw.close();
  }
});
