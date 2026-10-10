import { expect, test } from 'bun:test';
import { createDomainEvent } from '@libs/observability-shared/domain-event';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';
import { reconcileOutbox } from '@pkgs/outbox-shared/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';

test('authoritative domain events are durable, pseudonymous and logically deduplicated', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileOutbox(db);
    const event = createDomainEvent(
      defineEvent({
        name: 'example.space.created',
        owner: 'example',
        version: 1,
        description: 'A space was created.',
        delivery: 'reliable',
        attributes: {
          'space.id': { type: 'string', required: true },
          'subject.id': { type: 'string', required: true },
        },
      })
    );
    const env = {
      actorId: 'account-1',
      deviceId: 'device-1',
      accountId: 'account-1',
      isAnon: false,
      now: () => new Date(1000),
      createId: () => 'id-1',
      synthetic: true,
    };
    const input = {
      id: 'space with @ arbitrary identity',
      attributes: {
        'space.id': 'space with @ arbitrary identity',
        'subject.id': env.actorId,
      },
    };
    await event.record({ tx: db, env }, input);
    expect(
      await db.query(sql<{ id: string }>`SELECT id FROM outbox_events`)
    ).toHaveLength(0);
    await db.transaction(async (tx) => {
      await event.record({ tx, env: { ...env, serverNow: env.now } }, input);
      await event.record({ tx, env: { ...env, serverNow: env.now } }, input);
    });
    const rows = await db.query(
      sql<{ payload: string }>`SELECT payload FROM outbox_events`
    );
    expect(rows).toHaveLength(1);
    const payload = JSON.parse(rows[0]!.payload);
    if (!event.outbox.message.validatePayload(payload))
      throw new Error('Invalid stored telemetry');
    expect(payload.envelope.synthetic).toBe(true);
    expect(payload.envelope.occurredAtMs).toBe(1000);
    expect(payload.attributes['subject.id']).toHaveLength(64);
    expect(payload.attributes['space.id']).toHaveLength(64);
    expect(rows[0]!.payload).not.toContain('account-1');
    expect(rows[0]!.payload).not.toContain('arbitrary identity');
  } finally {
    await db.disconnect();
  }
});
