import {
  INBOX_INTERACTIONS_TABLE,
  InboxInteractionCol,
} from '@pkgs/inbox/sync/table-defs';
import { sql, type Sql, ident } from '@pkgs/sql';

import type { InteractionFilter } from '../shared/interaction';

function inboxFilterClause(filter: InteractionFilter): Sql {
  if (filter === 'archived') {
    return sql`${ident(InboxInteractionCol.archivedAt)} IS NOT NULL
      AND ${ident(InboxInteractionCol.dismissedAt)} IS NULL`;
  }
  if (filter === 'action_required') {
    return sql`${ident(InboxInteractionCol.archivedAt)} IS NULL
      AND ${ident(InboxInteractionCol.dismissedAt)} IS NULL
      AND ${ident(InboxInteractionCol.category)} = 'action_required'`;
  }
  return sql`${ident(InboxInteractionCol.archivedAt)} IS NULL
    AND ${ident(InboxInteractionCol.dismissedAt)} IS NULL`;
}

export function inboxListSql(userId: string, filter: InteractionFilter): Sql {
  if (userId.length === 0) {
    return sql`SELECT * FROM ${ident(INBOX_INTERACTIONS_TABLE)} WHERE 0`;
  }

  return sql`
    SELECT * FROM ${ident(INBOX_INTERACTIONS_TABLE)}
    WHERE ${ident(InboxInteractionCol.userId)} = ${userId}
      AND ${ident(InboxInteractionCol.active)} = 1
      AND ${inboxFilterClause(filter)}
    ORDER BY ${ident(InboxInteractionCol.priority)} DESC,
             ${ident(InboxInteractionCol.createdAt)} DESC,
             ${ident(InboxInteractionCol.id)} DESC`;
}

export function inboxUnreadCountSql(userId: string): Sql {
  if (userId.length === 0) {
    return sql`SELECT 0 AS count FROM ${ident(INBOX_INTERACTIONS_TABLE)} WHERE 0`;
  }
  return sql`
    SELECT COUNT(*) AS count FROM ${ident(INBOX_INTERACTIONS_TABLE)}
    WHERE ${ident(InboxInteractionCol.userId)} = ${userId}
      AND ${ident(InboxInteractionCol.active)} = 1
      AND ${ident(InboxInteractionCol.readAt)} IS NULL
      AND ${ident(InboxInteractionCol.archivedAt)} IS NULL
      AND ${ident(InboxInteractionCol.dismissedAt)} IS NULL`;
}
