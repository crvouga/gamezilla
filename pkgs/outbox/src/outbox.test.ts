import { describe, expect, test } from 'bun:test';
import { createMessageNamespace, isPlainRecord } from '@pkgs/message';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid';

import {
  defineOutboxConsumer,
  OutboxConsumerRegistry,
} from './define-consumer';
import { drainOutbox } from './drain';
import { migrateOutbox } from './migrate';
import { Outbox } from './outbox';

const ns = createMessageNamespace('outbox', 'test');

type PingPayload = { readonly n: number };

function isPing(p: unknown): p is PingPayload {
  return isPlainRecord(p) && typeof p['n'] === 'number';
}

const Ping = ns('ping', isPing);

describe('outbox', () => {
  test('send is idempotent by id; drain runs consumer once', async () => {
    const db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    await migrateOutbox(db);
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
    await migrateOutbox(db);
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
