import { type Sql, sql } from '@pkgs/sql';

import type { InteractionFilter } from '../shared/interaction';
import type { StoredInteractionRow } from '../shared/stored-interaction-row';

export type InboxUnreadCountRow = {
  readonly count: number | string;
};

export function inboxListSql(
  userId: string,
  filter: InteractionFilter
): Sql<StoredInteractionRow> {
  return sql<StoredInteractionRow>`
    SELECT *
      FROM inbox_interactions
     WHERE user_id = ${userId}
       AND active = true
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
      FROM inbox_interactions
     WHERE user_id = ${userId}
       AND active = true
       AND read_at IS NULL
       AND archived_at IS NULL
       AND dismissed_at IS NULL`;
}
