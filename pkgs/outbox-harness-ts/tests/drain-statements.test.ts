import { expect, test } from 'bun:test';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';

const ns = createMessageNamespace('outbox', 'statements');

/** Counts every statement sent inside a transaction, the unit of database latency. */
function countingClient(db: SqlClient): {
  readonly client: SqlClient;
  readonly statements: () => number;
} {
  let statements = 0;
  const wrap = (inner: SqlClient): SqlClient => ({
    connect: () => inner.connect(),
    disconnect: () => inner.disconnect(),
    prepare: (query) => inner.prepare(query),
    query: (query) => {
      statements += 1;
      return inner.query(query);
    },
    run: (query) => {
      statements += 1;
      return inner.run(query);
    },
    transaction: (fn) => inner.transaction((tx) => fn(wrap(tx))),
  });
  return { client: wrap(db), statements: () => statements };
}

async function drainStatements(
  consumerCount: number,
  pending: boolean
): Promise<{ statements: number; delivered: number }> {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileOutbox(db);
    const clock = { now: () => Date.parse('2026-10-01T00:00:00.000Z') };
    let nextId = 0;
    const createId = () => `event-${++nextId}`;
    const registry = new OutboxConsumerRegistry();
    const types = Array.from({ length: consumerCount }, (_, index) =>
      ns(
        `ping-${index}`,
        (value): value is { n: number } =>
          isPlainRecord(value) && typeof value['n'] === 'number'
      )
    );
    let delivered = 0;
    types.forEach((type, index) => {
      registry.register({
        id: `consumer-${index}`,
        on: type,
        handler: async () => {
          delivered += 1;
        },
      });
    });
    if (pending) {
      const outbox = new Outbox({
        tx: db,
        env: { now: () => new Date(clock.now()), createId },
      });
      for (const [index, type] of types.entries())
        await outbox.send({
          id: `event-${index}`,
          message: type({ n: index }),
        });
    }
    const counted = countingClient(db);
    await drainOutbox({ db: counted.client, clock, createId, registry });
    return { statements: counted.statements(), delivered };
  } finally {
    await db.disconnect();
  }
}

// regression: outbox-drain-statement-per-consumer
test('an idle drain sends the same few statements however many consumers are registered', async () => {
  const one = await drainStatements(1, false);
  const many = await drainStatements(33, false);
  expect(many.statements).toBe(one.statements);
  expect(many.statements).toBeLessThanOrEqual(3);
});

test('a drain sends a constant number of statements to make deliveries for every consumer', async () => {
  const few = await drainStatements(2, true);
  const many = await drainStatements(33, true);
  // Each pending delivery costs its own claim bookkeeping; making them does not.
  const perDelivery = (few.statements - 3) / 2;
  expect(many.delivered).toBe(33);
  expect(many.statements).toBe(3 + perDelivery * 33);
});
