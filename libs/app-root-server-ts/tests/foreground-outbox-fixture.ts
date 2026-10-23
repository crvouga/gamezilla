import {
  drainCommittedMutationOutbox,
  scopeMutationOutbox,
} from '@libs/app-root-server-ts/mutation-outbox';
import { drainAndNotifyOutbox } from '@libs/app-root-server-ts/outbox-drain';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { insertOutboxEvent, Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createSyncApp } from '@pkgs/sync-engine-server-ts/create-sync-app';
import type { CommittedMutations } from '@pkgs/sync-engine-server-ts/mutation-lifecycle';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { mutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-registry';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared-ts/tables';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';

const Ping = createMessageNamespace('foreground', 'recovery')(
  'ping',
  (value): value is { n: number } =>
    isPlainRecord(value) && typeof value['n'] === 'number'
);
const NOW = Date.parse('2026-10-01T00:00:00.000Z');

function deliveryPorts() {
  const failure = { root: false };
  const clock = { now: () => NOW };
  let id = 0;
  const createId = () => `id-${++id}`;
  const seen: number[] = [];
  const consumerRegistry = new OutboxConsumerRegistry();
  consumerRegistry.register({
    id: 'work',
    on: Ping,
    handler: async (ctx, event) => {
      if (event.n === 1) {
        await insertOutboxEvent(ctx.tx, {
          id: 'child',
          message: Ping({ n: 2 }),
          nowIso: new Date(NOW).toISOString(),
        });
        if (failure.root) throw new Error('Consumer rolled back');
      }
      seen.push(event.n);
      return { notifyUserIds: ['alice'] };
    },
  });
  const publications: { topic: string; payload: unknown }[] = [];
  const pubsub = {
    publish: async (topic: string, payload: unknown) => {
      publications.push({ topic, payload });
    },
  };
  const ports = {
    clock,
    createId,
    consumerRegistry,
    objectStore: new ObjectStoreImplInMemory(),
    pubsub: pubsub as never,
  };
  return { ports, seen, publications, failure };
}

function recordedMutations() {
  let bodies = 0;
  const make = (name: string) =>
    defineMutation({
      name,
      args: {
        '~standard': {
          version: 1,
          vendor: 'example',
          validate: () => ({ value: {} }),
        },
      },
      async run(ctx) {
        bodies += 1;
        if (name === 'noop') return;
        await new Outbox(ctx).send({ id: 'root', message: Ping({ n: 1 }) });
        if (name === 'reject') throw new MutationError('REFUSED', 'Refused');
      },
    });
  return {
    mutations: mutationRegistry(['make', 'noop', 'reject'].map(make)),
    bodies: () => bodies,
  };
}

function upload(
  app: ReturnType<typeof createSyncApp>,
  name: string,
  actor: string
) {
  return app.request('http://test/mutations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-test-actor': actor,
      [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
    },
    body: JSON.stringify({
      mutations: [
        {
          id: 'accepted-write',
          name,
          args: '{}',
          clientId: 'same-wire-client',
          seq: 1,
          createdAt: new Date(NOW).toISOString(),
          originTraceparent: null,
        },
      ],
    }),
  });
}

export async function openForegroundOutbox() {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  await reconcileSqliteSchema(db, syncEngineServerSchema, {
    ownership: 'declared-only',
  });
  await reconcileOutbox(db);
  const { ports, seen, publications, failure } = deliveryPorts();
  const { clock, createId } = ports;
  const drain = (batch: CommittedMutations, maxPasses?: number) =>
    drainCommittedMutationOutbox({
      batch,
      ...ports,
      ...(maxPasses === undefined ? {} : { maxPasses }),
    });
  let onCommitted = (batch: CommittedMutations) => drain(batch);
  const recorded = recordedMutations();
  const app = createSyncApp({
    resolveAuth: async (request) => ({
      actorId: request.headers.get('x-test-actor') ?? 'alice',
      deviceId: 'device',
      accountId: 'account',
      isAnon: false,
    }),
    getSql: () => db,
    queries: {},
    mutations: recorded.mutations,
    pubsub: ports.pubsub,
    topicMap: { outbox_events: { topics: () => ['example:mutation'] } },
    now: clock.now,
    createId,
    wrapMutationTx: scopeMutationOutbox,
    onCommittedMutations: (batch) => onCommitted(batch),
  });
  app.onError(
    () => new Response('Interrupted before acknowledgement', { status: 503 })
  );
  return {
    db,
    seen,
    publications,
    drain,
    send: (name = 'make', actor = 'alice') => upload(app, name, actor),
    bodies: recorded.bodies,
    failRoot: () => {
      failure.root = true;
    },
    onCommitted: (hook: typeof onCommitted) => {
      onCommitted = hook;
    },
    async seed() {
      await new Outbox({
        tx: db,
        env: { now: () => new Date(NOW), createId },
      }).send({ id: 'old-backlog', message: Ping({ n: 99 }) });
    },
    async pending() {
      return db.query(
        sql<{
          id: string;
          causation_id: string | null;
        }>`SELECT id, causation_id FROM outbox_events WHERE id NOT IN (SELECT event_id FROM outbox_deliveries WHERE processed_at IS NOT NULL) ORDER BY id`
      );
    },
    all: () => drainAndNotifyOutbox({ db, ...ports }),
  };
}
