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
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { openForegroundOutbox } from './foreground-outbox-fixture';

const Ping = createMessageNamespace('foreground', 'cost')(
  'ping',
  (value): value is { n: number } =>
    isPlainRecord(value) && typeof value['n'] === 'number'
);

test('a mutation with no causal work leaves the pending backlog to its owned drain', async () => {
  // regression: foreground-mutation-drains-unrelated-backlog
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileOutbox(db);
    const clock = { now: () => Date.parse('2026-10-01T00:00:00.000Z') };
    let nextId = 0;
    const createId = () => `generated-${++nextId}`;
    const consumerRegistry = new OutboxConsumerRegistry();
    const seen: number[] = [];
    consumerRegistry.register({
      id: 'work',
      on: Ping,
      handler: async (_ctx, event) => {
        seen.push(event.n);
      },
    });
    const outbox = new Outbox({
      tx: db,
      env: { now: () => new Date(clock.now()), createId },
    });
    for (const n of [1, 2, 3])
      await outbox.send({ id: `old-${n}`, message: Ping({ n }) });
    const foreground = { causationIds: [] as readonly string[] };
    const args = {
      db,
      clock,
      createId,
      consumerRegistry,
      pubsub: null,
      objectStore: new ObjectStoreImplInMemory(),
    };
    expect(await drainAndNotifyOutbox({ ...args, ...foreground })).toBe(0);
    expect(seen).toEqual([]);
    expect(await drainAndNotifyOutbox(args)).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
  } finally {
    await db.disconnect();
  }
});

test('a committed mutation publishes its root and chained child before acknowledgement', async () => {
  // regression: foreground-outbox-terminal-empty-pass
  const host = await openForegroundOutbox();
  try {
    await host.seed();
    const start = host.statements.length;
    expect((await host.send()).status).toBe(200);
    expect(host.seen).toEqual([1, 2]);
    expect(host.publications.map((publication) => publication.topic)).toEqual([
      'example:mutation',
      'user:alice',
      'user:alice',
    ]);
    const statements = host.statements.slice(start);
    expect(
      statements.filter((text) => text.includes('SELECT e.id AS event_id'))
    ).toHaveLength(2);
    expect(
      statements.filter((text) =>
        text.includes('SELECT event_id, consumer_id, attempts')
      )
    ).toHaveLength(2);
    expect(
      statements.filter((text) => text.includes('SELECT 1 AS due_work'))
    ).toHaveLength(1);
    expect(
      await host.db.query(
        sql<{
          event_id: string;
        }>`SELECT event_id FROM outbox_deliveries WHERE event_id = ${'old-backlog'}`
      )
    ).toEqual([]);
    expect((await host.pending()).map((event) => event.id)).toEqual([
      'old-backlog',
    ]);
    expect(await host.all()).toBe(1);
    expect(host.seen).toEqual([1, 2, 99]);
  } finally {
    await host.db.disconnect();
  }
});

test('a capped root-to-child upload does not probe after its final allowed pass', async () => {
  // regression: foreground-outbox-terminal-empty-pass
  const host = await openForegroundOutbox();
  try {
    await host.seed();
    host.onCommitted((batch) => host.drain(batch, 2));
    const start = host.statements.length;
    expect((await host.send()).status).toBe(200);
    expect(host.seen).toEqual([1, 2]);
    expect(host.publications.map((publication) => publication.topic)).toEqual([
      'example:mutation',
      'user:alice',
      'user:alice',
    ]);
    expect(
      host.statements
        .slice(start)
        .filter((text) => text.includes('SELECT 1 AS due_work'))
    ).toEqual([]);
  } finally {
    await host.db.disconnect();
  }
});

test('a rolled-back append retains the next pass after its sibling succeeds', async () => {
  // regression: foreground-outbox-terminal-empty-pass
  const host = await openForegroundOutbox();
  try {
    host.failRoot();
    const start = host.statements.length;
    expect((await host.send('makeSibling')).status).toBe(200);
    expect(host.seen).toEqual([2]);
    expect(
      await host.db.query(
        sql<{ id: string }>`SELECT id FROM outbox_events WHERE id = ${'child'}`
      )
    ).toEqual([]);
    const statements = host.statements.slice(start);
    expect(
      statements.filter((text) => text.includes('SELECT e.id AS event_id'))
    ).toHaveLength(2);
    expect(
      statements.filter((text) => text.includes('SELECT 1 AS due_work'))
    ).toEqual([]);
    expect((await host.pending()).map((event) => event.id)).toEqual(['root']);
  } finally {
    await host.db.disconnect();
  }
});

for (const interruptedAfterRoot of [false, true])
  test(`a duplicate recovers after interruption ${interruptedAfterRoot ? 'after root commit' : 'before the first delivery'}`, async () => {
    // regression: foreground-mutation-drains-unrelated-backlog
    const host = await openForegroundOutbox();
    try {
      await host.seed();
      host.onCommitted(async (batch) => {
        if (interruptedAfterRoot === true) await host.drain(batch, 1);
        throw new Error('Lost acknowledgement');
      });
      expect((await host.send()).status).toBe(503);
      expect(host.seen).toEqual(interruptedAfterRoot ? [1] : []);
      const pending = await host.pending();
      expect(
        pending.find(
          (event) => event.id === (interruptedAfterRoot ? 'child' : 'root')
        )?.causation_id
      ).toBe('["alice","accepted-write"]');
      host.onCommitted(async (batch) => {
        await host.drain(batch);
      });
      expect((await host.send('make', 'mallory')).status).toBe(200);
      expect(host.seen).toEqual(interruptedAfterRoot ? [1] : []);
      const retry = await host.send();
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({
        ackSeq: 1,
        verdicts: [{ mutationId: 'accepted-write', status: 'applied' }],
      });
      expect(host.bodies()).toBe(1);
      expect(
        host.publications.filter(
          (publication) => publication.topic === 'example:mutation'
        )
      ).toHaveLength(1);
      expect(host.seen).toEqual([1, 2]);
      expect((await host.pending()).map((event) => event.id)).toEqual([
        'old-backlog',
      ]);
      expect(await host.all()).toBe(1);
    } finally {
      await host.db.disconnect();
    }
  });

test('a mutation without events and a rolled-back mutation do not claim old work', async () => {
  for (const name of ['noop', 'reject']) {
    const host = await openForegroundOutbox();
    try {
      await host.seed();
      const response = await host.send(name);
      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as { verdicts: { status: string }[] })
          .verdicts[0]?.status
      ).toBe(name === 'reject' ? 'rejected' : 'applied');
      expect(host.seen).toEqual([]);
      expect(
        await host.db.query(
          sql<{ event_id: string }>`SELECT event_id FROM outbox_deliveries`
        )
      ).toEqual([]);
      expect(host.publications).toEqual([]);
      expect((await host.pending()).map((event) => event.id)).toEqual([
        'old-backlog',
      ]);
    } finally {
      await host.db.disconnect();
    }
  }
});

test('a rolled-back consumer does not persist its causal child', async () => {
  const host = await openForegroundOutbox();
  try {
    await host.seed();
    host.failRoot();
    expect((await host.send()).status).toBe(200);
    expect(host.seen).toEqual([]);
    expect((await host.pending()).map((event) => event.id)).toEqual([
      'old-backlog',
      'root',
    ]);
    expect(
      await host.db.query(
        sql<{ id: string }>`SELECT id FROM outbox_events WHERE id = ${'child'}`
      )
    ).toEqual([]);
    expect(
      await host.db.query(
        sql<{
          event_id: string;
        }>`SELECT event_id FROM outbox_deliveries WHERE event_id = ${'old-backlog'}`
      )
    ).toEqual([]);
  } finally {
    await host.db.disconnect();
  }
});
