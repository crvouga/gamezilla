import sql from '@pkgs/sql-shared/sql';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import { managedUpdatedAtIso } from '@pkgs/sync-engine-shared/managed-columns';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import type { Notification } from '@libs/notifications-shared/notification';
import { buildNotificationId } from '@libs/notifications-shared/notification-id';
import { NotificationsError } from '@libs/notifications-shared/notifications-errors';
import type {
  DeactivateNotificationInput,
  PublishNotificationInput,
  UpdateNotificationInput,
} from '@libs/notifications-shared/publish-types';
import { rowToNotification } from '@libs/notifications-shared/row-mapper';
import {
  findById,
  findBySource,
  upsertNotificationSql,
} from './publish-helpers';

export async function publishNotification(
  db: SqlTx,
  input: PublishNotificationInput,
  now: () => number,
  createId: CreateId
): Promise<Notification> {
  await db.run(upsertNotificationSql(input, now, createId));

  const row = await findById(
    db,
    buildNotificationId(input.source, input.userId)
  );
  if (row === null) {
    throw new NotificationsError(
      'NOTIFICATIONS_NOT_FOUND',
      'Notification publish failed'
    );
  }
  return rowToNotification(row);
}

export async function updateNotification(
  db: SqlTx,
  input: UpdateNotificationInput,
  now: () => number,
  createId: CreateId
): Promise<Notification> {
  return publishNotification(db, input, now, createId);
}

export async function deactivateNotification(
  db: SqlTx,
  input: DeactivateNotificationInput,
  now: () => number
): Promise<void> {
  const nowIso = managedUpdatedAtIso(now);
  await db.run(
    sql<void>`
      UPDATE notifications
         SET active = FALSE,
             updated_at = ${nowIso}
       WHERE user_id = ${input.userId}
         AND source_namespace = ${input.source.namespace}
         AND source_type = ${input.source.type}
         AND source_id = ${input.source.id}`
  );
}

export async function findNotificationById(
  db: SqlTx,
  actorId: string,
  interactionId: string
): Promise<Notification | null> {
  const row = await findById(db, interactionId);
  if (row === null || row.user_id !== actorId) return null;
  return rowToNotification(row);
}

export async function findNotificationBySource(
  db: SqlTx,
  lookup: {
    readonly userId: string;
    readonly source: PublishNotificationInput['source'];
  }
): Promise<Notification | null> {
  const row = await findBySource(db, {
    userId: lookup.userId,
    ...lookup.source,
  });
  if (row === null) return null;
  return rowToNotification(row);
}
