import { expect, test } from 'bun:test';
import {
  drainAndNotifyOutbox,
  setOutboxConsumerRegistry,
} from '@libs/app-root-server-ts/outbox-drain';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared-ts/tables';
import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import type { PushMessage } from '@pkgs/sync-engine-shared-ts/v2';
import fc from 'fast-check';

const notes = registerTables([
  defineTable({
    domain: 'notes',
    name: 'notes',
    columns: { owner_id: 'text', body: 'text' },
  }),
]);
const Ready = createMessageNamespace('outbox-images')(
  'ready',
  (_value): _value is Record<string, never> => true
);

async function publishRows(
  forbidImages: boolean,
  owners: readonly string[] = ['alice', 'bob'],
  fenced = true,
  options: { failAfterWrite?: boolean; registryTopicMap?: boolean } = {}
): Promise<Map<string, PushMessage>> {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileOutbox(db);
    for (const schema of [notes, syncEngineServerSchema])
      await reconcileSqliteSchema(db, schema);
    const consumerRegistry = new OutboxConsumerRegistry();
    consumerRegistry.register({
      id: 'save-notes',
      on: Ready,
      handler: async ({ tx }) => {
        for (const owner of owners)
          await tx.run(
            sql`INSERT INTO notes (id, owner_id, body) VALUES (${owner}, ${owner}, ${owner + '-only'})`
          );
        if (options.failAfterWrite)
          throw new Error('Delivery refused after captured writes');
        return { notifyUserIds: options.registryTopicMap ? [] : owners };
      },
    });
    const frames = new Map<string, PushMessage>();
    const pubsub: PubSub = {
      publish: async (topic, payload) => {
        frames.set(topic, payload as PushMessage);
      },
      subscribe: () => () => {},
      status: () => 'connected',
      onStatus: () => () => {},
      close: () => {},
    };
    const env = { now: () => new Date(0), createId: () => 'ready' };
    const topicMap: TopicMap = {
      notes: {
        topics: (row) => [`user:${String(row['owner_id'])}`],
        rowImage: { publish: () => !forbidImages },
      },
    };
    if (options.registryTopicMap)
      setOutboxConsumerRegistry(consumerRegistry, topicMap);
    await new Outbox({ tx: db, env }).send({ id: 'ready', message: Ready({}) });
    await drainAndNotifyOutbox({
      db,
      ...(fenced ? { nextCheckpoint: () => '2' } : {}),
      clock: { now: () => 0 },
      createId: env.createId,
      objectStore: new ObjectStoreImplInMemory(),
      consumerRegistry,
      pubsub,
      ...(options.registryTopicMap
        ? { eventTypes: [Ready.type] }
        : { topicMap }),
    });
    if (options.failAfterWrite)
      expect(await db.query(sql<{ id: string }>`SELECT id FROM notes`)).toEqual(
        []
      );
    return frames;
  } finally {
    await db.disconnect();
  }
}

// regression: outbox-results-require-extra-snapshot
// regression: outbox-row-images-lack-snapshot-fence
test('committed outbox rows reach only their own topic without another snapshot', async () => {
  const frames = await publishRows(false);
  expect([...frames.values()].map((frame) => frame.checkpoint)).toEqual([
    '2',
    '2',
  ]);
  expect(
    frames.get('user:alice')?.rows?.['notes']?.map((row) => row['body'])
  ).toEqual(['alice-only']);
  expect(
    frames.get('user:bob')?.rows?.['notes']?.map((row) => row['body'])
  ).toEqual(['bob-only']);
  expect(JSON.stringify(frames.get('user:alice'))).not.toContain('bob-only');
});

test('a host without a query checkpoint sends invalidations instead of unfenced rows', async () => {
  const frames = await publishRows(false, ['alice', 'bob'], false);
  expect([...frames.keys()].sort()).toEqual(['user:alice', 'user:bob']);
  expect([...frames.values()].every((frame) => frame.rows === undefined)).toBe(
    true
  );
});

test('a publication veto sends invalidations without any row images', async () => {
  const frames = await publishRows(true);
  expect([...frames.keys()].sort()).toEqual(['user:alice', 'user:bob']);
  expect([...frames.values()].every((frame) => frame.rows === undefined)).toBe(
    true
  );
});

// regression: outbox-rollback-publishes-captured-images
test('a failed consumer never publishes rows rolled back to its savepoint', async () => {
  const frames = await publishRows(false, ['alice'], true, {
    failAfterWrite: true,
  });
  expect([...frames]).toEqual([]);
});

test('row images respect topic ownership and publication vetoes for every recipient set', async () => {
  await assertProperty(
    'outbox row-image privacy',
    fc.asyncProperty(
      fc.uniqueArray(fc.constantFrom('alice', 'bob', 'carol'), {
        minLength: 1,
        maxLength: 3,
      }),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      async (owners, forbid, fail, registryTopicMap) => {
        const frames = await publishRows(forbid, owners, true, {
          failAfterWrite: fail,
          registryTopicMap,
        });
        if (fail) {
          expect([...frames]).toEqual([]);
          return;
        }
        expect([...frames.keys()].sort()).toEqual(
          owners.map((owner) => `user:${owner}`).sort()
        );
        for (const owner of owners) {
          const frame = frames.get(`user:${owner}`);
          expect(frame?.checkpoint).toBe('2');
          if (forbid) expect(frame?.rows).toBeUndefined();
          else
            expect(frame?.rows?.['notes']?.map((row) => row['body'])).toEqual([
              `${owner}-only`,
            ]);
        }
      }
    )
  );
});

// regression: scoped-outbox-loses-composed-topic-map
test('a typed drain preserves row topics from its composed registry', async () => {
  const frames = await publishRows(false, ['alice'], true, {
    registryTopicMap: true,
  });
  expect([...frames.keys()]).toEqual(['user:alice']);
  expect(
    frames.get('user:alice')?.rows?.['notes']?.map((row) => row['body'])
  ).toEqual(['alice-only']);
});
