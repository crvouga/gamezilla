import {
  INBOX_INTERACTIONS_TABLE,
  InboxInteractionCol,
} from '@pkgs/inbox/sync/table-defs';

import type { InteractionFilter } from '../shared/interaction';

export function inboxListSql(
  userId: string,
  filter: InteractionFilter
): { sql: string; params: string[] } {
  if (userId.length === 0) {
    return {
      sql: `SELECT * FROM ${INBOX_INTERACTIONS_TABLE} WHERE 0`,
      params: [],
    };
  }

  const conditions = [
    `${InboxInteractionCol.userId} = ?`,
    `${InboxInteractionCol.active} = 1`,
  ];
  const params: string[] = [userId];

  if (filter === 'archived') {
    conditions.push(`${InboxInteractionCol.archivedAt} IS NOT NULL`);
    conditions.push(`${InboxInteractionCol.dismissedAt} IS NULL`);
  } else {
    conditions.push(`${InboxInteractionCol.archivedAt} IS NULL`);
    conditions.push(`${InboxInteractionCol.dismissedAt} IS NULL`);
    if (filter === 'action_required') {
      conditions.push(`${InboxInteractionCol.category} = 'action_required'`);
    }
  }

  return {
    sql: `SELECT * FROM ${INBOX_INTERACTIONS_TABLE}
          WHERE ${conditions.join(' AND ')}
          ORDER BY ${InboxInteractionCol.priority} DESC,
                   ${InboxInteractionCol.createdAt} DESC,
                   ${InboxInteractionCol.id} DESC`,
    params,
  };
}

export function inboxUnreadCountSql(userId: string): {
  sql: string;
  params: string[];
} {
  if (userId.length === 0) {
    return {
      sql: `SELECT 0 AS count FROM ${INBOX_INTERACTIONS_TABLE} WHERE 0`,
      params: [],
    };
  }
  return {
    sql: `SELECT COUNT(*) AS count FROM ${INBOX_INTERACTIONS_TABLE}
          WHERE ${InboxInteractionCol.userId} = ?
            AND ${InboxInteractionCol.active} = 1
            AND ${InboxInteractionCol.readAt} IS NULL
            AND ${InboxInteractionCol.archivedAt} IS NULL
            AND ${InboxInteractionCol.dismissedAt} IS NULL`,
    params: [userId],
  };
}
