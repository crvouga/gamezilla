import { sql } from '@pkgs/sql';

import type { SqlTx } from '@pkgs/sql-client/interface';
import { dispatchNotificationAction } from '../../public/action-registry';
import type {
  NotificationListQuery,
  StoredNotificationRow,
} from '../../public/types';
import type { Notification } from '../../shared/notifications/notification';
import { NotificationsError } from '../../shared/notifications/notifications-errors';
import { findNotificationById } from '../../use-cases/publish-notification/server/publish';
import { rowToNotification } from './row-mapper';

const DEFAULT_LIMIT = 30;

export async function listInteractions(
  db: SqlTx,
  query: NotificationListQuery
): Promise<{
  items: readonly Notification[];
  nextCursor?: string;
  hasMore: boolean;
}> {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const filter = query.filter ?? 'all';
  const hasCursor = query.cursor !== undefined && query.cursor.length > 0;
  const cursor = query.cursor ?? null;

  const rows = await db.query(
    sql<StoredNotificationRow>`
      SELECT *
        FROM notifications
       WHERE user_id = ${query.userId}
         AND (
           ${filter} = 'archived'
           AND archived_at IS NOT NULL
           AND dismissed_at IS NULL
           OR ${filter} = 'action_required'
           AND active IS TRUE
           AND archived_at IS NULL
           AND dismissed_at IS NULL
           AND category = 'action_required'
           OR ${filter} NOT IN ('archived', 'action_required')
           AND active IS TRUE
           AND archived_at IS NULL
           AND dismissed_at IS NULL
         )
         AND (
           ${hasCursor} = false
           OR (priority, created_at, id) < (
             SELECT priority, created_at, id
               FROM notifications
              WHERE id = ${cursor}
           )
         )
       ORDER BY priority DESC, created_at DESC, id DESC
       LIMIT ${limit + 1}`
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map(rowToNotification);
  const lastId = page[page.length - 1]?.id;
  return {
    items,
    hasMore,
    ...(lastId !== undefined && hasMore ? { nextCursor: lastId } : {}),
  };
}

export async function markInteractionRead(
  db: SqlTx,
  actorId: string,
  interactionId: string,
  now: () => number
): Promise<Notification> {
  const existing = await findNotificationById(db, actorId, interactionId);
  if (existing === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification not found'
    );
  }
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE notifications
         SET read_at = ${nowIso}, updated_at = ${nowIso}
       WHERE id = ${interactionId} AND user_id = ${actorId}`
  );
  const updated = await findNotificationById(db, actorId, interactionId);
  if (updated === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification not found'
    );
  }
  return updated;
}

export async function markAllInteractionsRead(
  db: SqlTx,
  actorId: string,
  now: () => number
): Promise<void> {
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE notifications
         SET read_at = ${nowIso}, updated_at = ${nowIso}
       WHERE user_id = ${actorId}
         AND read_at IS NULL
         AND active IS TRUE
         AND archived_at IS NULL
         AND dismissed_at IS NULL`
  );
}

export async function archiveInteraction(
  db: SqlTx,
  actorId: string,
  interactionId: string,
  now: () => number
): Promise<Notification> {
  const existing = await findNotificationById(db, actorId, interactionId);
  if (existing === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification not found'
    );
  }
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE notifications
         SET archived_at = ${nowIso},
             read_at = COALESCE(read_at, ${nowIso}),
             updated_at = ${nowIso}
       WHERE id = ${interactionId} AND user_id = ${actorId}`
  );
  const updated = await findNotificationById(db, actorId, interactionId);
  if (updated === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification not found'
    );
  }
  return updated;
}

export async function dismissInteraction(
  db: SqlTx,
  actorId: string,
  interactionId: string,
  now: () => number
): Promise<Notification> {
  const existing = await findNotificationById(db, actorId, interactionId);
  if (existing === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification not found'
    );
  }
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE notifications
         SET dismissed_at = ${nowIso},
             read_at = COALESCE(read_at, ${nowIso}),
             updated_at = ${nowIso}
       WHERE id = ${interactionId} AND user_id = ${actorId}`
  );
  const updated = await findNotificationById(db, actorId, interactionId);
  if (updated === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification not found'
    );
  }
  return updated;
}

export async function performNotificationAction(
  db: SqlTx,
  actorId: string,
  interactionId: string,
  actionId: string
): Promise<Notification> {
  const interaction = await findNotificationById(db, actorId, interactionId);
  if (interaction === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification not found'
    );
  }
  await dispatchNotificationAction({
    sql: db,
    actorId,
    interaction,
    actionId,
  });
  const updated = await findNotificationById(db, actorId, interactionId);
  if (updated === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification not found'
    );
  }
  return updated;
}

export async function countUnreadInteractions(
  db: SqlTx,
  userId: string
): Promise<number> {
  const rows = await db.query(
    sql<{ count: number | string }>`
      SELECT COUNT(*) AS count
        FROM notifications
       WHERE user_id = ${userId}
         AND active IS TRUE
         AND read_at IS NULL
         AND archived_at IS NULL
         AND dismissed_at IS NULL`
  );
  return Number(rows[0]?.count ?? 0);
}
