import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';

import type { NotificationFilter } from './notification';
import type { StoredNotificationRow } from './stored-notification-row';

export type InboxUnreadCountRow = {
  readonly count: number | string;
};

export function inboxListSql(
  userId: string,
  filter: NotificationFilter
): Sql<StoredNotificationRow> {
  return sql<StoredNotificationRow>`
    SELECT *
      FROM notifications
     WHERE user_id = ${userId}
       AND active IS TRUE
       AND (
         ${filter} = 'archived'
         AND archived_at IS NOT NULL
         AND dismissed_at IS NULL
         OR ${filter} = 'action_required'
         AND archived_at IS NULL
         AND dismissed_at IS NULL
         AND category = 'action_required'
         OR ${filter} NOT IN ('archived', 'action_required')
         AND archived_at IS NULL
         AND dismissed_at IS NULL
       )
     ORDER BY priority DESC, created_at DESC, id DESC`;
}

export function inboxUnreadCountSql(userId: string): Sql<InboxUnreadCountRow> {
  return sql<InboxUnreadCountRow>`
    SELECT COUNT(*) AS count
      FROM notifications
     WHERE user_id = ${userId}
       AND active IS TRUE
       AND read_at IS NULL
       AND archived_at IS NULL
       AND dismissed_at IS NULL`;
}
