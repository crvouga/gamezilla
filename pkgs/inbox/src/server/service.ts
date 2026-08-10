import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

import { InboxError } from '../shared/inbox-errors';
import type { Interaction } from '../shared/interaction';
import { dispatchInteractionAction } from './action-registry';
import { findInteractionById } from './publish';
import { rowToInteraction } from './row-mapper';
import type { InteractionListQuery, StoredInteractionRow } from './types';

const DEFAULT_LIMIT = 30;

export async function listInteractions(
  db: SqlClient,
  query: InteractionListQuery
): Promise<{
  items: readonly Interaction[];
  nextCursor?: string;
  hasMore: boolean;
}> {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const filter = query.filter ?? 'all';
  const hasCursor = query.cursor !== undefined && query.cursor.length > 0;
  const cursor = query.cursor ?? null;

  const rows = await db.query(
    sql<StoredInteractionRow>`
      SELECT *
        FROM inbox_interactions
       WHERE user_id = ${query.userId}
         AND (
           ${filter} = 'archived'
           AND archived_at IS NOT NULL
           AND dismissed_at IS NULL
           OR ${filter} = 'action_required'
           AND active = true
           AND archived_at IS NULL
           AND dismissed_at IS NULL
           AND category = 'action_required'
           OR ${filter} NOT IN ('archived', 'action_required')
           AND active = true
           AND archived_at IS NULL
           AND dismissed_at IS NULL
         )
         AND (
           ${hasCursor} = false
           OR (priority, created_at, id) < (
             SELECT priority, created_at, id
               FROM inbox_interactions
              WHERE id = ${cursor}
           )
         )
       ORDER BY priority DESC, created_at DESC, id DESC
       LIMIT ${limit + 1}`
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
  db: SqlClient,
  actorId: string,
  interactionId: string,
  now: () => number
): Promise<Interaction> {
  const existing = await findInteractionById(db, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE inbox_interactions
         SET read_at = ${nowIso}, updated_at = ${nowIso}
       WHERE id = ${interactionId} AND user_id = ${actorId}`
  );
  const updated = await findInteractionById(db, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function markAllInteractionsRead(
  db: SqlClient,
  actorId: string,
  now: () => number
): Promise<void> {
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE inbox_interactions
         SET read_at = ${nowIso}, updated_at = ${nowIso}
       WHERE user_id = ${actorId}
         AND read_at IS NULL
         AND active = true
         AND archived_at IS NULL
         AND dismissed_at IS NULL`
  );
}

export async function archiveInteraction(
  db: SqlClient,
  actorId: string,
  interactionId: string,
  now: () => number
): Promise<Interaction> {
  const existing = await findInteractionById(db, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE inbox_interactions
         SET archived_at = ${nowIso},
             read_at = COALESCE(read_at, ${nowIso}),
             updated_at = ${nowIso}
       WHERE id = ${interactionId} AND user_id = ${actorId}`
  );
  const updated = await findInteractionById(db, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function dismissInteraction(
  db: SqlClient,
  actorId: string,
  interactionId: string,
  now: () => number
): Promise<Interaction> {
  const existing = await findInteractionById(db, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE inbox_interactions
         SET dismissed_at = ${nowIso},
             read_at = COALESCE(read_at, ${nowIso}),
             updated_at = ${nowIso}
       WHERE id = ${interactionId} AND user_id = ${actorId}`
  );
  const updated = await findInteractionById(db, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function performInteractionAction(
  db: SqlClient,
  actorId: string,
  interactionId: string,
  actionId: string
): Promise<Interaction> {
  const interaction = await findInteractionById(db, actorId, interactionId);
  if (interaction === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  await dispatchInteractionAction({
    sql: db,
    actorId,
    interaction,
    actionId,
  });
  const updated = await findInteractionById(db, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function countUnreadInteractions(
  db: SqlClient,
  userId: string
): Promise<number> {
  const rows = await db.query(
    sql<{ count: string }>`
      SELECT COUNT(*)::text AS count
        FROM inbox_interactions
       WHERE user_id = ${userId}
         AND active = true
         AND read_at IS NULL
         AND archived_at IS NULL
         AND dismissed_at IS NULL`
  );
  return Number(rows[0]?.count ?? 0);
}
