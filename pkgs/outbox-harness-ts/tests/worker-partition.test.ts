import { expect, test } from 'bun:test';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

const ping = createMessageNamespace('worker')(
  'ping',
  (value): value is { n: number } =>
    isPlainRecord(value) && typeof value['n'] === 'number'
);
test('a worker leaves another consumer and event partition unclaimed', async () => {
  // regression: outbox-worker-claimed-foreign-delivery
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileOutbox(db);
    const clock = { now: () => Date.parse('2026-10-01T00:00:00.000Z') };
    let nextId = 0;
    const createId = () => `generated-${++nextId}`;
    const all = new OutboxConsumerRegistry();
    const seen: string[] = [];
    for (const id of ['export', 'erase'])
      all.register({
        id,
        on: ping,
        handler: async (_ctx, p) => {
          seen.push(`${id}:${p.n}`);
        },
      });
    const outbox = new Outbox({
      tx: db,
      env: { now: () => new Date(clock.now()), createId },
    });
    await outbox.send({ id: 'alice', message: ping({ n: 1 }) });
    await outbox.send({ id: 'bob', message: ping({ n: 2 }) });
    // regression: outbox-empty-partition-materializes-foreign-deliveries
    expect(
      (await drainOutbox({ db, clock, createId, registry: all, eventIds: [] }))
        .processed
    ).toBe(0);
    expect(
      await db.query(
        sql<{ event_id: string }>`SELECT event_id FROM outbox_deliveries`
      )
    ).toEqual([]);
    await drainOutbox({ db, clock, createId, registry: all, limit: 0 });
    const worker = new OutboxConsumerRegistry();
    worker.register(all.get('export')!);
    expect(
      (
        await drainOutbox({
          db,
          clock,
          createId,
          registry: worker,
          eventIds: ['alice'],
        })
      ).processed
    ).toBe(1);
    expect(seen).toEqual(['export:1']);
    const untouched = await db.query(
      sql<{
        attempts: number;
      }>`SELECT attempts FROM outbox_deliveries WHERE consumer_id = ${'erase'} OR event_id = ${'bob'}`
    );
    expect(untouched.map((row) => row.attempts)).toEqual([0, 0, 0]);
    expect(
      (await drainOutbox({ db, clock, createId, registry: all })).processed
    ).toBe(3);
    expect(seen).toContain('erase:1');
    expect(seen).toContain('erase:2');
    expect(seen).toContain('export:2');
  } finally {
    await db.disconnect();
  }
});
