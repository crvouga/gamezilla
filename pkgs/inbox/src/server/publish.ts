import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

import { InboxError } from '../shared/inbox-errors';
import type { Interaction } from '../shared/interaction';
import { buildInteractionId } from '../shared/interaction-id';
import {
  findById,
  findBySource,
  upsertInteractionSql,
} from './publish-helpers';
import { rowToInteraction } from './row-mapper';
import type {
  DeactivateInteractionInput,
  PublishInteractionInput,
  UpdateInteractionInput,
} from './types';

export async function publishInteraction(
  db: SqlClient,
  input: PublishInteractionInput,
  now: () => number
): Promise<Interaction> {
  const nowIso = new Date(now()).toISOString();
  await db.run(upsertInteractionSql(input, nowIso));

  const row = await findById(
    db,
    buildInteractionId(input.source, input.userId)
  );
  if (row === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction publish failed');
  }
  return rowToInteraction(row);
}

export async function updateInteraction(
  db: SqlClient,
  input: UpdateInteractionInput,
  now: () => number
): Promise<Interaction> {
  return publishInteraction(db, input, now);
}

export async function deactivateInteraction(
  db: SqlClient,
  input: DeactivateInteractionInput,
  now: () => number
): Promise<void> {
  const nowIso = new Date(now()).toISOString();
  await db.run(
    sql<void>`
      UPDATE inbox_interactions
         SET active = false, updated_at = ${nowIso}
       WHERE user_id = ${input.userId}
         AND source_namespace = ${input.source.namespace}
         AND source_type = ${input.source.type}
         AND source_id = ${input.source.id}`
  );
}

export async function findInteractionById(
  db: SqlClient,
  actorId: string,
  interactionId: string
): Promise<Interaction | null> {
  const row = await findById(db, interactionId);
  if (row === null || row.user_id !== actorId) return null;
  return rowToInteraction(row);
}

export async function findInteractionBySource(
  db: SqlClient,
  lookup: {
    readonly userId: string;
    readonly source: PublishInteractionInput['source'];
  }
): Promise<Interaction | null> {
  const row = await findBySource(db, {
    userId: lookup.userId,
    ...lookup.source,
  });
  if (row === null) return null;
  return rowToInteraction(row);
}

export type { PublishInteractionInput } from './types';
export { buildInteractionId, findById as findStoredInteractionById };
