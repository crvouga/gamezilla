import {
  INBOX_INTERACTIONS_TABLE,
  InboxInteractionCol,
} from '@pkgs/inbox/sync/table-defs';
import { honey, type Expr, type Sql } from '@pkgs/sql';

import type { InteractionFilter } from '../shared/interaction';

function inboxFilterExpr(filter: InteractionFilter): Expr {
  if (filter === 'archived') {
    return [
      'and',
      ['is-not-null', InboxInteractionCol.archivedAt],
      ['is-null', InboxInteractionCol.dismissedAt],
    ];
  }
  if (filter === 'action_required') {
    return [
      'and',
      ['is-null', InboxInteractionCol.archivedAt],
      ['is-null', InboxInteractionCol.dismissedAt],
      ['=', InboxInteractionCol.category, 'action_required'],
    ];
  }
  return [
    'and',
    ['is-null', InboxInteractionCol.archivedAt],
    ['is-null', InboxInteractionCol.dismissedAt],
  ];
}

export function inboxListSql(userId: string, filter: InteractionFilter): Sql {
  if (userId.length === 0) {
    return honey({
      select: ['*'],
      from: INBOX_INTERACTIONS_TABLE,
      where: false,
    });
  }

  return honey({
    select: ['*'],
    from: INBOX_INTERACTIONS_TABLE,
    where: [
      'and',
      ['=', InboxInteractionCol.userId, userId],
      ['=', InboxInteractionCol.active, 1],
      inboxFilterExpr(filter),
    ],
    orderBy: [
      [InboxInteractionCol.priority, 'desc'],
      [InboxInteractionCol.createdAt, 'desc'],
      [InboxInteractionCol.id, 'desc'],
    ],
  });
}

export function inboxUnreadCountSql(userId: string): Sql {
  if (userId.length === 0) {
    return honey({
      select: [[['cast', 0, 'int'], 'count']],
      from: INBOX_INTERACTIONS_TABLE,
      where: false,
    });
  }
  return honey({
    select: [[['count', '*'], 'count']],
    from: INBOX_INTERACTIONS_TABLE,
    where: [
      'and',
      ['=', InboxInteractionCol.userId, userId],
      ['=', InboxInteractionCol.active, 1],
      ['is-null', InboxInteractionCol.readAt],
      ['is-null', InboxInteractionCol.archivedAt],
      ['is-null', InboxInteractionCol.dismissedAt],
    ],
  });
}
