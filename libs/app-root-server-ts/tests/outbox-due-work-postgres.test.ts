import { expect, test } from 'bun:test';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { withOutboxCausation } from '@pkgs/outbox-shared-ts/causation';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import { hasDueOutboxWork } from '@pkgs/outbox-shared-ts/due-work';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutboxPostgres } from '@pkgs/outbox-shared-ts/reconcile';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';

const Ping = createMessageNamespace('outbox', 'postgres-witness')(
  'ping',
  (value): value is { n: number } =>
    isPlainRecord(value) && typeof value['n'] === 'number'
);

test('PostgreSQL witnesses scoped materialized and unmaterialized work with timestamp availability', async () => {
  let now = Date.parse('2026-10-01T00:00:00.000Z');
  const clock = { now: () => now };
  const db = SqlClientImplMockingbirdPostgres.open({
    seed: 7,
    now: () => new Date(now),
  });
  await db.connect();
  try {
    await reconcileOutboxPostgres(db, {
      dbScope: db.dbScope,
      alreadyInTransaction: false,
    });
    const registry = new OutboxConsumerRegistry();
    const seen: number[] = [];
    registry.register({
      id: 'work',
      on: Ping,
      handler: async (_ctx, event) => {
        seen.push(event.n);
      },
    });
    let nextId = 0;
    const deps = {
      db,
      clock,
      registry,
      createId: () => `generated-${++nextId}`,
      causationIds: ['alice'],
    };
    for (const [id, causation, n, delay] of [
      ['root', 'alice', 1, 0],
      ['foreign', 'bob', 2, 0],
      ['future', 'alice', 3, 10],
    ] as const)
      await new Outbox({
        tx: withOutboxCausation(db, causation),
        env: { now: () => new Date(now), createId: deps.createId },
      }).send({
        id,
        message: Ping({ n }),
        availableAt: new Date(now + delay),
      });
    expect(await hasDueOutboxWork({ ...deps, eventIds: ['future'] })).toBe(
      false
    );
    expect(await hasDueOutboxWork({ ...deps, causationIds: ['nobody'] })).toBe(
      false
    );
    expect(await hasDueOutboxWork(deps)).toBe(true);
    expect((await drainOutbox(deps)).processed).toBe(1);
    expect(await hasDueOutboxWork(deps)).toBe(false);
    expect(await hasDueOutboxWork({ ...deps, causationIds: ['bob'] })).toBe(
      true
    );
    now += 10;
    expect(await hasDueOutboxWork(deps)).toBe(true);
    expect((await drainOutbox(deps)).processed).toBe(1);
    expect(seen).toEqual([1, 3]);
    expect(await hasDueOutboxWork(deps)).toBe(false);
  } finally {
    await db.disconnect();
  }
});
