import { expect, test } from 'bun:test';
import { changeSpaceRoomMembership } from '@libs/spaces-shared-ts/space-withdrawal';
import { playerJoinedEvent } from '@libs/spaces-shared-ts/telemetry';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

// regression: otel-membership-clock-collision
test('membership transitions at the same instant retain distinct durable logical identities', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  let sequence = 0;
  const env = {
    actorId: 'participant',
    accountId: 'participant',
    deviceId: 'device',
    isAnon: false,
    synthetic: false,
    now: () => new Date(1000),
    serverNow: () => new Date(1000),
    createId: () => `membership-${sequence++}`,
  };
  try {
    await reconcileOutbox(db);
    for (let operation = 0; operation < 2; operation += 1) {
      await db.transaction(async (tx) => {
        const id = await changeSpaceRoomMembership(
          { tx, env },
          'space-1',
          'joined',
          env.actorId
        );
        expect(typeof id).toBe('string');
        await playerJoinedEvent.record(
          { tx, env },
          {
            id,
            attributes: { 'space.id': 'space-1', 'subject.id': env.actorId },
          }
        );
      });
    }
    const rows = await db.query(
      sql<{ payload: string }>`SELECT payload FROM outbox_events`
    );
    const telemetry = rows
      .map((row) => JSON.parse(row.payload))
      .filter(playerJoinedEvent.outbox.message.validatePayload);
    expect(rows).toHaveLength(4);
    expect(telemetry).toHaveLength(2);
    expect(new Set(telemetry.map((event) => event.envelope.id)).size).toBe(2);
    expect(telemetry.map((event) => event.envelope.occurredAtMs)).toEqual([
      1000, 1000,
    ]);
  } finally {
    await db.disconnect();
  }
});
