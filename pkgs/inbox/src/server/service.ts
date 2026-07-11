import type { SqlClient } from '@pkgs/sql-client/interface';

import type { Interaction } from '../shared/interaction';
import { InboxError } from '../shared/inbox-errors';
import { dispatchInteractionAction } from './action-registry';
import { findInteractionById } from './publish';
import { rowToInteraction } from './row-mapper';
import type { InteractionListQuery, StoredInteractionRow } from './types';

const DEFAULT_LIMIT = 30;

function listWhereClause(filter: InteractionListQuery['filter']): {
  sql: string;
  params: unknown[];
} {
  switch (filter) {
    case 'archived':
      return {
        sql: `archived_at IS NOT NULL AND dismissed_at IS NULL`,
        params: [],
      };
    case 'action_required':
      return {
        sql: `active = true AND archived_at IS NULL AND dismissed_at IS NULL AND category = 'action_required'`,
        params: [],
      };
    default:
      return {
        sql: `active = true AND archived_at IS NULL AND dismissed_at IS NULL`,
        params: [],
      };
  }
}

export async function listInteractions(
  sql: SqlClient,
  query: InteractionListQuery
): Promise<{
  items: readonly Interaction[];
  nextCursor?: string;
  hasMore: boolean;
}> {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const filter = query.filter ?? 'all';
  const { sql: filterSql } = listWhereClause(filter);
  const params: unknown[] = [query.userId];

  let cursorSql = '';
  if (query.cursor !== undefined && query.cursor.length > 0) {
    cursorSql = `AND (priority, created_at, id) < (
      SELECT priority, created_at, id FROM inbox_interactions WHERE id = ?
    )`;
    params.push(query.cursor);
  }

  params.push(limit + 1);

  const rows = await sql.query<StoredInteractionRow>(
    `SELECT * FROM inbox_interactions
     WHERE user_id = ?
       AND ${filterSql}
       ${cursorSql}
     ORDER BY priority DESC, created_at DESC, id DESC
     LIMIT ?`,
    params
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map(rowToInteraction);
  const lastId = page[page.length - 1]?.id;
  return {
    items,
    hasMore,
    ...(lastId !== undefined && hasMore ? { nextCursor: lastId } : {}),
  };
}

export async function markInteractionRead(
  sql: SqlClient,
  actorId: string,
  interactionId: string
): Promise<Interaction> {
  const existing = await findInteractionById(sql, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const now = new Date().toISOString();
  await sql.run(
    `UPDATE inbox_interactions SET read_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    [now, now, interactionId, actorId]
  );
  const updated = await findInteractionById(sql, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function markAllInteractionsRead(
  sql: SqlClient,
  actorId: string
): Promise<void> {
  const now = new Date().toISOString();
  await sql.run(
    `UPDATE inbox_interactions
     SET read_at = ?, updated_at = ?
     WHERE user_id = ?
       AND read_at IS NULL
       AND active = true
       AND archived_at IS NULL
       AND dismissed_at IS NULL`,
    [now, now, actorId]
  );
}

export async function archiveInteraction(
  sql: SqlClient,
  actorId: string,
  interactionId: string
): Promise<Interaction> {
  const existing = await findInteractionById(sql, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const now = new Date().toISOString();
  await sql.run(
    `UPDATE inbox_interactions
     SET archived_at = ?, read_at = COALESCE(read_at, ?), updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [now, now, now, interactionId, actorId]
  );
  const updated = await findInteractionById(sql, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function dismissInteraction(
  sql: SqlClient,
  actorId: string,
  interactionId: string
): Promise<Interaction> {
  const existing = await findInteractionById(sql, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const now = new Date().toISOString();
  await sql.run(
    `UPDATE inbox_interactions
     SET dismissed_at = ?, read_at = COALESCE(read_at, ?), updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [now, now, now, interactionId, actorId]
  );
  const updated = await findInteractionById(sql, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function performInteractionAction(
  sql: SqlClient,
  actorId: string,
  interactionId: string,
  actionId: string
): Promise<Interaction> {
  const interaction = await findInteractionById(sql, actorId, interactionId);
  if (interaction === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  await dispatchInteractionAction({
    sql,
    actorId,
    interaction,
    actionId,
  });
  const updated = await findInteractionById(sql, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function countUnreadInteractions(
  sql: SqlClient,
  userId: string
): Promise<number> {
  const rows = await sql.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM inbox_interactions
     WHERE user_id = ?
       AND active = true
       AND read_at IS NULL
       AND archived_at IS NULL
       AND dismissed_at IS NULL`,
    [userId]
  );
  return Number(rows[0]?.count ?? 0);
}
