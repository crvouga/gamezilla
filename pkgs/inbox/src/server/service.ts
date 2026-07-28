import { col, empty, honey, raw, sql, type Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { Interaction } from '../shared/interaction';
import { InboxError } from '../shared/inbox-errors';
import { dispatchInteractionAction } from './action-registry';
import { findInteractionById } from './publish';
import { rowToInteraction } from './row-mapper';
import type { InteractionListQuery, StoredInteractionRow } from './types';

const DEFAULT_LIMIT = 30;

function listFilterClause(filter: InteractionListQuery['filter']): Sql {
  switch (filter) {
    case 'archived':
      return raw('archived_at IS NOT NULL AND dismissed_at IS NULL');
    case 'action_required':
      return raw(
        `active = true AND archived_at IS NULL AND dismissed_at IS NULL AND category = 'action_required'`
      );
    default:
      return raw(
        'active = true AND archived_at IS NULL AND dismissed_at IS NULL'
      );
  }
}

function listCursorClause(cursor: string | undefined): Sql {
  if (cursor === undefined || cursor.length === 0) return empty;
  return sql`AND (priority, created_at, id) < (
      SELECT priority, created_at, id FROM inbox_interactions WHERE id = ${cursor}
    )`;
}

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

  // honey: row-value tuple cursor `(priority, created_at, id) < (SELECT …)` has
  // no honey representation (row constructors / composite comparisons).
  const rows = await db.query<StoredInteractionRow>(sql`
    SELECT * FROM inbox_interactions
     WHERE user_id = ${query.userId}
       AND ${listFilterClause(filter)}
       ${listCursorClause(query.cursor)}
     ORDER BY priority DESC, created_at DESC, id DESC
     LIMIT ${limit + 1}`);

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
  interactionId: string
): Promise<Interaction> {
  const existing = await findInteractionById(db, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const now = new Date().toISOString();
  await db.run(
    honey({
      update: 'inbox_interactions',
      set: { read_at: now, updated_at: now },
      where: ['and', ['=', 'id', interactionId], ['=', 'user_id', actorId]],
    })
  );
  const updated = await findInteractionById(db, actorId, interactionId);
  if (updated === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  return updated;
}

export async function markAllInteractionsRead(
  db: SqlClient,
  actorId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.run(
    honey({
      update: 'inbox_interactions',
      set: { read_at: now, updated_at: now },
      where: [
        'and',
        ['=', 'user_id', actorId],
        ['is-null', 'read_at'],
        ['=', 'active', true],
        ['is-null', 'archived_at'],
        ['is-null', 'dismissed_at'],
      ],
    })
  );
}

export async function archiveInteraction(
  db: SqlClient,
  actorId: string,
  interactionId: string
): Promise<Interaction> {
  const existing = await findInteractionById(db, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const now = new Date().toISOString();
  await db.run(
    honey({
      update: 'inbox_interactions',
      set: {
        archived_at: now,
        read_at: ['coalesce', col('read_at'), now],
        updated_at: now,
      },
      where: ['and', ['=', 'id', interactionId], ['=', 'user_id', actorId]],
    })
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
  interactionId: string
): Promise<Interaction> {
  const existing = await findInteractionById(db, actorId, interactionId);
  if (existing === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction not found');
  }
  const now = new Date().toISOString();
  await db.run(
    honey({
      update: 'inbox_interactions',
      set: {
        dismissed_at: now,
        read_at: ['coalesce', col('read_at'), now],
        updated_at: now,
      },
      where: ['and', ['=', 'id', interactionId], ['=', 'user_id', actorId]],
    })
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
  const rows = await db.query<{ count: string }>(
    honey({
      select: [[['cast', ['count', '*'], 'text'], 'count']],
      from: 'inbox_interactions',
      where: [
        'and',
        ['=', 'user_id', userId],
        ['=', 'active', true],
        ['is-null', 'read_at'],
        ['is-null', 'archived_at'],
        ['is-null', 'dismissed_at'],
      ],
    })
  );
  return Number(rows[0]?.count ?? 0);
}
