import { expect, test } from 'bun:test';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import { drainOutbox } from '@pkgs/outbox-shared/drain';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';

const ns = createMessageNamespace('outbox', 'exhaustion');
const Ping = ns(
  'ping',
  (value): value is { n: number } =>
    isPlainRecord(value) && typeof value['n'] === 'number'
);

// regression: outbox-exhaustion-invisible
test('a delivery parked after its last attempt is reported by the drain', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  await reconcileOutbox(db);
  let now = Date.parse('2026-10-01T00:00:00.000Z');
  const clock = { now: () => now };
  const createId = () => 'event-1';
  const registry = new OutboxConsumerRegistry();
  registry.register({
    id: 'always-fails',
    on: Ping,
    retryPolicy: { maxAttempts: 2, backoffMs: [1_000] },
    handler: async () => {
      throw new Error('provider down');
    },
  });
  await new Outbox({
    tx: db,
    env: { now: () => new Date(now), createId },
  }).send({ id: 'event-1', message: Ping({ n: 1 }) });

  const first = await drainOutbox({ db, clock, createId, registry });
  expect(first).toMatchObject({ processed: 0, exhausted: 0 });

  now += 1_000;
  const last = await drainOutbox({ db, clock, createId, registry });
  expect(last).toMatchObject({ processed: 0, exhausted: 1 });

  now += 1_000;
  const parked = await drainOutbox({ db, clock, createId, registry });
  expect(parked).toMatchObject({ processed: 0, exhausted: 0 });
  await db.disconnect();
});

test('a payload no consumer can read is parked at once and reported', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  await reconcileOutbox(db);
  const now = Date.parse('2026-10-01T00:00:00.000Z');
  const clock = { now: () => now };
  const createId = () => 'event-2';
  const registry = new OutboxConsumerRegistry();
  registry.register({ id: 'reader', on: Ping, handler: async () => {} });
  await new Outbox({
    tx: db,
    env: { now: () => new Date(now), createId },
  }).send({
    id: 'event-2',
    message: { type: Ping({ n: 2 }).type, payload: { n: 'two' } },
  });

  const result = await drainOutbox({ db, clock, createId, registry });
  expect(result).toMatchObject({ processed: 0, exhausted: 1 });
  await db.disconnect();
});
