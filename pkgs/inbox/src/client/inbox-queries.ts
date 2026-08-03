import { sql, type Sql } from '@pkgs/sql';

import type { InteractionFilter } from '../shared/interaction';

export function inboxListSql(userId: string, filter: InteractionFilter): Sql {
  return sql`
    SELECT *
      FROM inbox_interactions
     WHERE user_id = ${userId}
       AND active = 1
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

export function inboxUnreadCountSql(userId: string): Sql {
  return sql`
    SELECT COUNT(*) AS count
      FROM inbox_interactions
     WHERE user_id = ${userId}
       AND active = 1
       AND read_at IS NULL
       AND archived_at IS NULL
       AND dismissed_at IS NULL`;
}
