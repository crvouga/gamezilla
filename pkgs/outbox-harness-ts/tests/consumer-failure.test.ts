import { expect, test } from 'bun:test';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import type {
  DeliveryInfo,
  DeliveryResult,
} from '@pkgs/outbox-shared-ts/drain';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

const ns = createMessageNamespace('outbox', 'consumer-failure');
const Ping = ns(
  'ping',
  (value): value is { n: number } =>
    isPlainRecord(value) && typeof value['n'] === 'number'
);
const NOW = Date.parse('2026-10-01T00:00:00.000Z');

class DatabaseError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

/**
 * Postgres refuses every statement of a transaction after one fails, until the
 * transaction returns to a savepoint. SQLite does not, which is how a drain that
 * recorded a consumer's failure on the aborted transaction passed every test.
 */
function postgresAborts(db: SqlClient, failure: DatabaseError): SqlClient {
  const wrap = (inner: SqlClient): SqlClient => {
    let aborted = false;
    const guard = (statement: string): void => {
      if (/^\s*ROLLBACK TO SAVEPOINT/i.test(statement)) {
        aborted = false;
        return;
      }
      if (aborted)
        throw new DatabaseError(
          'current transaction is aborted, commands ignored until end of transaction block',
          '25P02'
        );
      if (statement.includes('conflicting_table')) {
        aborted = true;
        throw failure;
      }
    };
    return {
      connect: () => inner.connect(),
      disconnect: () => inner.disconnect(),
      prepare: (query) => inner.prepare(query),
      query: (query) => {
        guard(query.sql);
        return inner.query(query);
      },
      run: (query) => {
        guard(query.sql);
        return inner.run(query);
      },
      transaction: (fn) => inner.transaction((tx) => fn(wrap(tx))),
    };
  };
  return wrap(db);
}

async function deliveries(db: SqlClient) {
  return db.query(
    sql<{
      consumer_id: string;
      attempts: number;
      processed_at: string | null;
      available_at: string;
      last_error: string | null;
    }>`SELECT consumer_id, attempts, processed_at, available_at, last_error FROM outbox_deliveries ORDER BY consumer_id`
  );
}

async function drainWithFailingConsumer(failure: DatabaseError) {
  const raw = SqlClientImplBunSqlite.open(':memory:');
  await raw.connect();
  await reconcileOutbox(raw);
  const clock = { now: () => NOW };
  let nextId = 0;
  const createId = () => `generated-${++nextId}`;
  const outbox = new Outbox({
    tx: raw,
    env: { now: () => new Date(NOW), createId },
  });
  await outbox.send({ id: 'ping-1', message: Ping({ n: 1 }) });
  const registry = new OutboxConsumerRegistry();
  const delivered: string[] = [];
  registry.register({
    id: 'a-conflicting',
    on: Ping,
    handler: async (ctx) => {
      await ctx.tx.run(sql`UPDATE conflicting_table SET n = 1`);
    },
  });
  registry.register({
    id: 'b-healthy',
    on: Ping,
    handler: async () => {
      delivered.push('b-healthy');
    },
  });
  const observed: Array<{ info: DeliveryInfo; result: DeliveryResult }> = [];
  const result = await drainOutbox({
    db: postgresAborts(raw, failure),
    clock,
    createId,
    registry,
    observeDelivery: async (info, run) => {
      const outcome = await run();
      observed.push({ info, result: outcome });
      return outcome;
    },
  });
  const rows = await deliveries(raw);
  await raw.disconnect();
  return { result, rows, delivered, observed };
}

// regression: outbox-failed-consumer-aborts-whole-drain
test('a consumer that fails does not stop the pass or the other deliveries', async () => {
  const { result, rows, delivered } = await drainWithFailingConsumer(
    new DatabaseError('relation "conflicting_table" is unavailable', 'XX000')
  );
  expect(result.processed).toBe(1);
  expect(delivered).toEqual(['b-healthy']);
  const failed = rows.find((row) => row.consumer_id === 'a-conflicting');
  expect(failed?.attempts).toBe(1);
  expect(failed?.processed_at).toBeNull();
  expect(failed?.last_error).toContain('conflicting_table');
  expect(Date.parse(failed?.available_at ?? '')).toBeGreaterThan(NOW);
  expect(
    rows.find((row) => row.consumer_id === 'b-healthy')?.processed_at
  ).not.toBeNull();
});

// regression: outbox-failed-consumer-aborts-whole-drain
test('losing a database race is retried without spending an attempt', async () => {
  const { rows } = await drainWithFailingConsumer(
    new DatabaseError(
      'could not serialize access due to concurrent update',
      '40001'
    )
  );
  const raced = rows.find((row) => row.consumer_id === 'a-conflicting');
  expect(raced?.attempts).toBe(0);
  expect(raced?.processed_at).toBeNull();
  expect(Date.parse(raced?.available_at ?? '')).toBeGreaterThan(NOW);
});

test('the host sees which consumer failed and why', async () => {
  const { observed } = await drainWithFailingConsumer(
    new DatabaseError('relation "conflicting_table" is unavailable', 'XX000')
  );
  const failed = observed.find(
    (entry) => entry.info.consumerId === 'a-conflicting'
  );
  expect(failed?.info.eventType).toBe(Ping.type);
  expect(failed?.info.attempt).toBe(1);
  expect(failed?.result.ok).toBe(false);
  expect(failed?.result.failure).toContain('conflicting_table');
  expect(
    observed.find((entry) => entry.info.consumerId === 'b-healthy')?.result.ok
  ).toBe(true);
});
