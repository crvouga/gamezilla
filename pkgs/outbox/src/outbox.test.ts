import { describe, expect, test } from 'bun:test';
import { createMessageNamespace, isPlainRecord } from '@pkgs/message';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid';
import { sql } from '@pkgs/sql';

import {
  defineOutboxConsumer,
  OutboxConsumerRegistry,
} from './define-consumer';
import { drainOutbox } from './drain';
import { Outbox } from './outbox';
import { reconcileOutbox } from './reconcile';

const ns = createMessageNamespace('outbox', 'test');

type PingPayload = { readonly n: number };

function isPing(p: unknown): p is PingPayload {
  return isPlainRecord(p) && typeof p['n'] === 'number';
}

const Ping = ns('ping', isPing);

describe('outbox', () => {
  // regression: outbox-event-availability-ignored
  test('a future event cannot be delivered before its availability time', async () => {
    const db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await reconcileOutbox(db);
    let now = Date.parse('2026-10-01T00:00:00.000Z');
    const clock = { now: () => now };
    const createId = () => 'scheduled-event';
    const registry = new OutboxConsumerRegistry();
    const seen: number[] = [];
    registry.register({
      id: 'scheduled',
      on: Ping,
      handler: async (_ctx, payload) => {
        seen.push(payload.n);
      },
    });
    await new Outbox({
      tx: db,
      env: { now: () => new Date(now), createId },
    }).send({ id: 'scheduled-event', message: Ping({ n: 7 }) });
    await db.run(
      sql`UPDATE outbox_events SET available_at = ${'2026-10-31T00:00:00.000Z'} WHERE id = ${'scheduled-event'}`
    );
    expect(
      (await drainOutbox({ db, clock, createId, registry })).processed
    ).toBe(0);
    expect(seen).toEqual([]);
    now = Date.parse('2026-10-31T00:00:00.000Z');
    expect(
      (await drainOutbox({ db, clock, createId, registry })).processed
    ).toBe(1);
    expect(seen).toEqual([7]);
    await db.disconnect();
  });
  test('send is idempotent by id; drain runs consumer once', async () => {
    const db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await reconcileOutbox(db);
    const adapters = createHarnessAdapters({ seed: 1 });
    const seen: number[] = [];
    const registry = new OutboxConsumerRegistry();
    registry.register(
      defineOutboxConsumer({
        id: 'ping-notify',
        on: Ping,
        async handler(_ctx, payload) {
          seen.push(payload.n);
        },
      })
    );

    const ctx = {
      tx: db,
      env: {
        now: () => new Date(adapters.clock.now()),
        createId: () => adapters.createId(),
      },
    };
    await db.transaction(async (tx) => {
      const outbox = new Outbox({ ...ctx, tx });
      await outbox.send({
        id: 'ping:1',
        message: Ping({ n: 7 }),
      });
      await outbox.send({
        id: 'ping:1',
        message: Ping({ n: 99 }),
      });
    });

    const n1 = await drainOutbox({
      db,
      clock: adapters.clock,
      createId: adapters.createId,
      registry,
    });
    expect(n1.processed).toBe(1);
    expect(seen).toEqual([7]);
    const n2 = await drainOutbox({
      db,
      clock: adapters.clock,
      createId: adapters.createId,
      registry,
    });
    expect(n2.processed).toBe(0);
    expect(seen).toEqual([7]);
    await db.disconnect();
  });

  test('two consumers get independent deliveries', async () => {
    const db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await reconcileOutbox(db);
    const adapters = createHarnessAdapters({ seed: 2 });
    const a: number[] = [];
    const b: number[] = [];
    const registry = new OutboxConsumerRegistry();
    registry.register(
      defineOutboxConsumer({
        id: 'a',
        on: Ping,
        async handler(_ctx, payload) {
          a.push(payload.n);
        },
      })
    );
    registry.register(
      defineOutboxConsumer({
        id: 'b',
        on: Ping,
        async handler(_ctx, payload) {
          b.push(payload.n);
        },
      })
    );

    await db.transaction(async (tx) => {
      await new Outbox({
        tx,
        env: {
          now: () => new Date(adapters.clock.now()),
          createId: () => adapters.createId(),
        },
      }).send({ id: 'ping:2', message: Ping({ n: 3 }) });
    });

    await drainOutbox({
      db,
      clock: adapters.clock,
      createId: adapters.createId,
      registry,
    });
    expect(a).toEqual([3]);
    expect(b).toEqual([3]);
    await db.disconnect();
  });
});
