import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';
import fc from 'fast-check';

async function settle(): Promise<void> {
  for (let turn = 0; turn < 200; turn += 1) await Promise.resolve();
}

async function openTransientQuery(failures: number) {
  const db = SqlClientImplBunSqlite.openMemory();
  const time = createHarnessClock();
  let requests = 0;
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
    postQueries: async (batch) => {
      requests += 1;
      if (requests <= failures) throw new HttpNetworkError('net::ERR_FAILED');
      return batch.map(() => ({ status: 'not_modified' as const }));
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
  const lookup = engine.subscribeQuery('notes', { title: 'bob' });
  let answered = false;
  void lookup.waitForFirstSync().then(() => {
    answered = true;
  });
  return {
    engine,
    time,
    requests: () => requests,
    answered: () => answered,
    close: async () => {
      lookup.unsubscribe();
      await engine.disconnect();
      await db.disconnect();
    },
  };
}

async function recoversAfter(failures: number): Promise<void> {
  const fixture = await openTransientQuery(failures);
  try {
    await fixture.engine.connect();
    await settle();
    expect(fixture.engine.status.getSnapshot().online).toBe(false);
    expect(fixture.answered()).toBe(false);
    for (let failure = 0; failure < failures; failure += 1) {
      fixture.time.clock.advance(1000 * 2 ** failure);
      await settle();
    }
    expect(fixture.answered()).toBe(true);
    expect(fixture.engine.status.getSnapshot().online).toBe(true);
    const requests = fixture.requests();
    fixture.time.clock.advance(60_000);
    await settle();
    expect(fixture.requests()).toBe(requests);
  } finally {
    await fixture.close();
  }
  expect(fixture.time.clock.pendingOneShotCount()).toBe(0);
}

// regression: transient-query-leaves-link-offline
test('net::ERR_FAILED on the first link lookup recovers without another browser or push event', async () => {
  await recoversAfter(1);
});

test('transient query failures back off and stop retrying once the query answers', async () => {
  await assertProperty(
    'query recovery after transient failures',
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), recoversAfter)
  );
});

test('disconnect cancels recovery before its pending network retry can run', async () => {
  const fixture = await openTransientQuery(100);
  await fixture.engine.connect();
  await settle();
  expect(fixture.time.clock.pendingOneShotCount()).toBe(1);
  const requests = fixture.requests();
  await fixture.close();
  fixture.time.clock.advance(60_000);
  await settle();
  expect(fixture.requests()).toBe(requests);
  expect(fixture.time.clock.pendingOneShotCount()).toBe(0);
});

test('an unrelated query answering does not cancel recovery of an unanswered lookup', async () => {
  const fixture = await openTransientQuery(1);
  try {
    await fixture.engine.connect();
    await settle();
    const unrelated = fixture.engine.subscribeQuery('notes', {
      title: 'carol',
    });
    await unrelated.waitForFirstSync();
    await settle();
    expect(fixture.answered()).toBe(false);
    fixture.time.clock.advance(1000);
    await settle();
    expect(fixture.answered()).toBe(true);
    unrelated.unsubscribe();
  } finally {
    await fixture.close();
  }
});
