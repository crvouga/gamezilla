import { expect, test } from 'bun:test';
import { friendRequestSentNotifyConsumer } from '@libs/friends-server-ts/friends-outbox-consumers';
import { FRIENDS_TABLES } from '@libs/friends-shared-ts/tables';
import { NOTIFICATIONS_TABLES } from '@libs/notifications-shared-ts/tables';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import sql from '@pkgs/sql-root-shared-ts/sql';

const STAMP = '2026-10-01T00:00:00.000Z';
const delayed = {
  requestId: 'closed-before-delivery',
  fromUserId: 'alice',
  toUserId: 'bob',
};

// regression: friend-closed-request-late-notification
// Literal input: cancellation is committed before the original sent event arrives.
test('a delayed sent event cannot revive a closed request notification', async () => {
  const db = await openConformanceDb([
    ...FRIENDS_TABLES,
    ...PROFILE_TABLES,
    ...NOTIFICATIONS_TABLES,
  ]);
  try {
    await db.run(sql`
      INSERT INTO friends_requests (id, from_user_id, to_user_id, status, created_at, updated_at)
      VALUES (${delayed.requestId}, ${'alice'}, ${'bob'}, ${'cancelled'}, ${STAMP}, ${STAMP})`);
    const context = {
      tx: db,
      clock: { now: () => 1_790_812_800_000 },
      createId: () => 'fixed-notification',
    };
    await friendRequestSentNotifyConsumer.handler(context, delayed);
    await friendRequestSentNotifyConsumer.handler(context, delayed);
    const rows = await db.query(
      sql<{ id: string }>`SELECT id FROM notifications WHERE active IS TRUE`
    );
    expect(rows).toEqual([]);
    await db.run(sql`
      INSERT INTO friends_requests (id, from_user_id, to_user_id, status, created_at, updated_at)
      VALUES (${'new-request'}, ${'alice'}, ${'bob'}, ${'pending'}, ${STAMP}, ${STAMP})`);
    await friendRequestSentNotifyConsumer.handler(context, delayed);
    expect(
      await db.query(
        sql<{ id: string }>`SELECT id FROM notifications WHERE active IS TRUE`
      )
    ).toEqual([]);
    await friendRequestSentNotifyConsumer.handler(context, {
      ...delayed,
      requestId: 'new-request',
    });
    await friendRequestSentNotifyConsumer.handler(context, {
      ...delayed,
      requestId: 'new-request',
    });
    expect(
      await db.query(
        sql<{ id: string }>`SELECT id FROM notifications WHERE active IS TRUE`
      )
    ).toEqual([{ id: 'friends:friend-request:new-request:bob' }]);
  } finally {
    await db.disconnect();
  }
});
