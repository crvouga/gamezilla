import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';
import { notesAllQuery } from '@pkgs/sync-engine-harness-ts/queries';
import { NOTES_ALL_TOPIC } from '@pkgs/sync-engine-harness-ts/topics';
import {
  readLastPushSeq,
  recordPushApplied,
} from '@pkgs/sync-engine-shared-ts/push-applied';
import fc from 'fast-check';

async function pushHost() {
  const raw = new Database(':memory:');
  const db = new SqlClientImplBunSqlite(raw);
  const time = createHarnessClock();
  const listeners = new Map<Topic, (data: unknown) => void>();
  const pubsub: PubSub = {
    publish: async () => undefined,
    subscribe: (topic, listener) => {
      listeners.set(topic, listener);
      return () => listeners.delete(topic);
    },
    status: () => 'connected',
    onStatus: () => () => undefined,
    close: () => undefined,
  };
  let snapshots = 0;
  const engine = await createLocalSyncEngine({
    db,
    localSchema: exampleLocalSchema,
    mutationRegistry: {},
    getMutationEnv: () => ({
      actorId: 'alice',
      accountId: 'alice',
      deviceId: 'phone',
      isAnon: false,
      now: () => new Date(time.clock.now()),
      createId: () => 'id',
    }),
    getClientId: () => 'phone',
    sessionQueries: [{ name: notesAllQuery.name, params: {} }],
    postQueries: async (requests) => {
      snapshots += 1;
      return requests.map(() => ({
        status: 'ok' as const,
        checkpoint: '1',
        hash: 'initial',
        tables: { notes: [], folders: [] },
      }));
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
    push: {
      queryRegistry: { [notesAllQuery.name]: notesAllQuery },
      createPubSub: () => pubsub,
      getChannelsCtx: () => ({ actorId: 'alice' }),
      rowImageFanout: true,
    },
  });
  await engine.connect();
  await engine.refreshQueries();
  await engine.waitForFirstSync();
  await recordPushApplied(db, NOTES_ALL_TOPIC, '1', { now: time.clock.now });
  return { db, raw, time, engine, listeners, snapshots: () => snapshots };
}

async function burst(length: number) {
  const host = await pushHost();
  try {
    const before = host.snapshots();
    const receive = host.listeners.get(NOTES_ALL_TOPIC);
    if (receive === undefined)
      throw new Error('The notes topic was not subscribed');
    for (let i = 0; i < length; i++)
      receive({
        pushSeq: String(i + 2),
        tables: ['notes'],
        rows: {
          notes: [
            {
              id: 'note',
              owner_id: 'alice',
              title: 'A note',
              body: `revision-${i}`,
              folder_id: null,
              space_id: null,
              created_at: new Date(0).toISOString(),
              updated_at: new Date(i + 1).toISOString(),
              deleted_at: null,
            },
          ],
        },
      });
    for (let i = 0; i < 500; i++) {
      await Promise.resolve();
      if (i % 20 === 0) host.time.clock.advance(10);
    }
    const rows = await host.db.query(
      sql<{ body: string }>`SELECT body FROM notes WHERE id = ${'note'}`
    );
    return {
      body: rows[0]?.body,
      seq: await readLastPushSeq(host.db, NOTES_ALL_TOPIC, {
        now: host.time.clock.now,
      }),
      refetches: host.snapshots() - before,
    };
  } finally {
    await host.engine.disconnect();
    host.raw.close();
  }
}

// regression: contiguous-pushes-race-their-applied-sequence
test('two consecutive pushes apply in delivery order without another snapshot', async () => {
  expect(await burst(2)).toEqual({
    body: 'revision-1',
    seq: '3',
    refetches: 0,
  });
});

test('every contiguous burst keeps its final row and sequence without refetching', async () => {
  await assertProperty(
    'contiguous push delivery order',
    fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (length) => {
      expect(await burst(length)).toEqual({
        body: `revision-${length - 1}`,
        seq: String(length + 1),
        refetches: 0,
      });
    })
  );
});
