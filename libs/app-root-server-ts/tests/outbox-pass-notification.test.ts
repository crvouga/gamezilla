import { expect, test } from 'bun:test';
import { drainAndNotifyOutbox } from '@libs/app-root-server-ts/outbox-drain';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared-ts/tables';
import fc from 'fast-check';

const Step = createMessageNamespace('notification-chain')(
  'step',
  (value): value is { n: number } =>
    isPlainRecord(value) && typeof value['n'] === 'number'
);

async function notificationOrder(
  length: number,
  scoped = false
): Promise<string[]> {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileOutbox(db);
    await reconcileSqliteSchema(db, syncEngineServerSchema);
    const order: string[] = [];
    const clock = { now: () => 0 };
    let nextId = 0;
    const env = {
      now: () => new Date(0),
      createId: () => `generated-${++nextId}`,
    };
    const consumerRegistry = new OutboxConsumerRegistry();
    consumerRegistry.register({
      id: 'chain',
      on: Step,
      handler: async (ctx, payload) => {
        order.push(`deliver:${payload.n}`);
        if (payload.n < length)
          await new Outbox({ tx: ctx.tx, env }).send({
            id: String(payload.n + 1),
            message: Step({ n: payload.n + 1 }),
          });
        return { notifyUserIds: ['alice'] };
      },
    });
    const pubsub: PubSub = {
      publish: async () => {
        order.push(
          `push:${order.filter((entry) => entry.startsWith('push:')).length + 1}`
        );
      },
      subscribe: () => () => {},
      status: () => 'connected',
      onStatus: () => () => {},
      close: () => {},
    };
    if (scoped)
      await new Outbox({ tx: db, env }).send({
        id: 'foreign',
        message: Step({ n: 99 }),
      });
    await new Outbox({ tx: db, env }).send({
      id: '1',
      message: Step({ n: 1 }),
    });
    await drainAndNotifyOutbox({
      db,
      clock,
      createId: env.createId,
      consumerRegistry,
      ...(scoped ? { eventIds: ['1'] } : {}),
      pubsub,
      objectStore: new ObjectStoreImplInMemory(),
    });
    if (scoped)
      expect(
        await db.query(
          sql<{
            event_id: string;
          }>`SELECT event_id FROM outbox_deliveries WHERE event_id = ${'foreign'}`
        )
      ).toEqual([]);
    return order;
  } finally {
    await db.disconnect();
  }
}

// regression: outbox-notifications-wait-for-whole-drain
test('the first committed result is pushed before the following delivery runs', async () => {
  expect(await notificationOrder(2)).toEqual([
    'deliver:1',
    'push:1',
    'deliver:2',
    'push:2',
  ]);
});

test('each committed pass is published before the next pass in any bounded chain', async () => {
  await assertProperty(
    'outbox pass notification order',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 5 }),
      fc.boolean(),
      async (length, scoped) => {
        expect(await notificationOrder(length, scoped)).toEqual(
          Array.from({ length }, (_, index) => [
            `deliver:${index + 1}`,
            `push:${index + 1}`,
          ]).flat()
        );
      }
    )
  );
});

// regression: mutation-drains-unrelated-outbox-backlog
// regression: request-outbox-registration-scans-backlog
test('a request follows its causal chain without registering or delivering unrelated backlog', async () => {
  expect(await notificationOrder(2, true)).toEqual([
    'deliver:1',
    'push:1',
    'deliver:2',
    'push:2',
  ]);
});
