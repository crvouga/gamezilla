import { Database } from 'bun:sqlite';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';
import { notesAllQuery } from '@pkgs/sync-engine-harness-ts/queries';
import { NOTES_ALL_TOPIC } from '@pkgs/sync-engine-harness-ts/topics';
import { recordPushApplied } from '@pkgs/sync-engine-shared-ts/push-applied';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';

export async function pushHost() {
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
  let snapshot: QueryResponse = {
    status: 'ok',
    checkpoint: '1',
    hash: 'initial',
    tables: { notes: [], folders: [] },
  };
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
      return requests.map(() => snapshot);
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
  return {
    db,
    raw,
    time,
    engine,
    listeners,
    snapshots: () => snapshots,
    setSnapshot: (next: QueryResponse) => {
      snapshot = next;
    },
  };
}
