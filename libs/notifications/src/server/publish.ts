import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';
import { managedUpdatedAtIso } from '@pkgs/sync-engine/shared';
import type { CreateId } from '@pkgs/uuid';
import type { Notification } from '../shared/notification';
import { buildNotificationId } from '../shared/notification-id';
import { NotificationsError } from '../shared/notifications-errors';
import {
  findById,
  findBySource,
  upsertNotificationSql,
} from './publish-helpers';
import { rowToNotification } from './row-mapper';
import type {
  DeactivateNotificationInput,
  PublishNotificationInput,
  UpdateNotificationInput,
} from './types';

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

export type { PublishNotificationInput } from './types';
export { buildNotificationId, findById as findStoredNotificationById };
