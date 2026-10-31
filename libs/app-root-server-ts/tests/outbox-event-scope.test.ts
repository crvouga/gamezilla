import { expect, test } from 'bun:test';
import { drainAndNotifyOutbox } from '@libs/app-root-server-ts/outbox-drain';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql, { type Sql } from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';

const ns = createMessageNamespace('scoped-subscriptions');
const valid = (v: unknown): v is { n: number } =>
  isPlainRecord(v) && typeof v['n'] === 'number';
const First = ns('first', valid);
const Next = ns('next', valid);
const Other = ns('other', valid);

function observe(
  db: SqlClient,
  inspect: (query: Sql<unknown>) => void
): SqlClient {
  return {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    prepare: (query) => db.prepare(query),
    query: (query) => {
      inspect(query);
      return db.query(query);
    },
    run: (query) => {
      inspect(query);
      return db.run(query);
    },
    transaction: (fn) => db.transaction((tx) => fn(observe(tx, inspect))),
  };
}

async function causalChain(length: number, completeImages = true) {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileOutbox(db);
    const registry = new OutboxConsumerRegistry();
    const delivered: number[] = [];
    let nextId = 0;
    const env = {
      now: () => new Date(0),
      createId: () => `generated-${++nextId}`,
    };
    for (const [id, on] of [
      ['first', First],
      ['next', Next],
    ] as const)
      registry.register({
        id,
        on,
        handler: async (ctx, payload) => {
          delivered.push(payload.n);
          if (payload.n >= length) return;
          const message = Next({ n: payload.n + 1 });
          const eventId = String(payload.n + 1);
          if (completeImages)
            await new Outbox({ tx: ctx.tx, env }).send({
              id: eventId,
              message,
            });
          else
            await ctx.tx.query(sql<{ id: string }>`INSERT INTO outbox_events
          (id, type, payload, available_at, created_at, updated_at, deleted_at)
          VALUES (${eventId}, ${message.type}, ${JSON.stringify(message.payload)},
            ${env.now().toISOString()}, ${env.now().toISOString()}, ${env.now().toISOString()}, ${null}) RETURNING id`);
        },
      });
    for (let i = 0; i < 32; i++)
      registry.register({
        id: `extra-${i}`,
        on: Other,
        handler: async () => {
          throw new Error('An unrelated event was delivered');
        },
      });
    for (const [id, message] of [
      ['1', First({ n: 1 })],
      ['foreign', Other({ n: 99 })],
    ] as const)
      await new Outbox({ tx: db, env }).send({ id, message });
    let extraSubscriptions = 0;
    const counted = observe(db, (query) => {
      if (query.sql.includes('SELECT e.id AS event_id'))
        extraSubscriptions = Math.max(
          extraSubscriptions,
          query.values.filter(
            (value) => typeof value === 'string' && value.startsWith('extra-')
          ).length
        );
    });
    await drainAndNotifyOutbox({
      db: counted,
      clock: { now: () => 0 },
      createId: env.createId,
      objectStore: new ObjectStoreImplInMemory(),
      consumerRegistry: registry,
      eventIds: ['1'],
      eventTypes: [First.type],
    });
    expect(
      await db.query(
        sql<{
          id: string;
        }>`SELECT id FROM outbox_deliveries WHERE event_id = ${'foreign'}`
      )
    ).toEqual([]);
    return { delivered, extraSubscriptions };
  } finally {
    await db.disconnect();
  }
}

// regression: request-outbox-expands-unrelated-subscriptions
test('a request registers only subscriptions to its known event types and captured children', async () => {
  expect(await causalChain(2)).toEqual({
    delivered: [1, 2],
    extraSubscriptions: 0,
  });
});

test('missing child type images retain every consumer rather than dropping the child', async () => {
  expect((await causalChain(2, false)).delivered).toEqual([1, 2]);
});

test('typed causal chains reach every child without expanding unrelated subscriptions', async () => {
  await assertProperty(
    'scoped outbox subscriptions',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 5 }),
      fc.boolean(),
      async (length, complete) => {
        const result = await causalChain(length, complete);
        expect(result.delivered).toEqual(
          Array.from({ length }, (_, i) => i + 1)
        );
        if (complete) expect(result.extraSubscriptions).toBe(0);
      }
    )
  );
});
