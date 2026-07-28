import {
  INBOX_INTERACTIONS_TABLE,
  InboxInteractionCol,
} from '@pkgs/inbox/sync/table-defs';
import { raw, sql, type Sql } from '@pkgs/sql';

import type { InteractionFilter } from '../shared/interaction';

function inboxFilterClause(filter: InteractionFilter): Sql {
  if (filter === 'archived') {
    return sql`${raw(InboxInteractionCol.archivedAt)} IS NOT NULL
      AND ${raw(InboxInteractionCol.dismissedAt)} IS NULL`;
  }
  if (filter === 'action_required') {
    return sql`${raw(InboxInteractionCol.archivedAt)} IS NULL
      AND ${raw(InboxInteractionCol.dismissedAt)} IS NULL
      AND ${raw(InboxInteractionCol.category)} = 'action_required'`;
  }
  return sql`${raw(InboxInteractionCol.archivedAt)} IS NULL
    AND ${raw(InboxInteractionCol.dismissedAt)} IS NULL`;
}

export function inboxListSql(userId: string, filter: InteractionFilter): Sql {
  if (userId.length === 0) {
    return sql`SELECT * FROM ${raw(INBOX_INTERACTIONS_TABLE)} WHERE 0`;
  }

  return sql`
    SELECT * FROM ${raw(INBOX_INTERACTIONS_TABLE)}
    WHERE ${raw(InboxInteractionCol.userId)} = ${userId}
      AND ${raw(InboxInteractionCol.active)} = 1
      AND ${inboxFilterClause(filter)}
    ORDER BY ${raw(InboxInteractionCol.priority)} DESC,
             ${raw(InboxInteractionCol.createdAt)} DESC,
             ${raw(InboxInteractionCol.id)} DESC`;
}

export function inboxUnreadCountSql(userId: string): Sql {
  if (userId.length === 0) {
    return sql`SELECT 0 AS count FROM ${raw(INBOX_INTERACTIONS_TABLE)} WHERE 0`;
  }
  return sql`
    SELECT COUNT(*) AS count FROM ${raw(INBOX_INTERACTIONS_TABLE)}
    WHERE ${raw(InboxInteractionCol.userId)} = ${userId}
      AND ${raw(InboxInteractionCol.active)} = 1
      AND ${raw(InboxInteractionCol.readAt)} IS NULL
      AND ${raw(InboxInteractionCol.archivedAt)} IS NULL
      AND ${raw(InboxInteractionCol.dismissedAt)} IS NULL`;
}
