import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';
import { managedUpdatedAtIso } from '@pkgs/sync-engine/shared';
import type { CreateId } from '@pkgs/uuid';

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
  db: SqlTx,
  input: PublishInteractionInput,
  now: () => number,
  createId: CreateId
): Promise<Interaction> {
  await db.run(upsertInteractionSql(input, now, createId));

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
  db: SqlTx,
  input: UpdateInteractionInput,
  now: () => number,
  createId: CreateId
): Promise<Interaction> {
  return publishInteraction(db, input, now, createId);
}

export async function deactivateInteraction(
  db: SqlTx,
  input: DeactivateInteractionInput,
  now: () => number
): Promise<void> {
  const nowIso = managedUpdatedAtIso(now);
  await db.run(
    sql<void>`
      UPDATE inbox_interactions
         SET active = false,
             updated_at = ${nowIso},
             updated_at = ${nowIso}
       WHERE user_id = ${input.userId}
         AND source_namespace = ${input.source.namespace}
         AND source_type = ${input.source.type}
         AND source_id = ${input.source.id}`
  );
}

export async function findInteractionById(
  db: SqlTx,
  actorId: string,
  interactionId: string
): Promise<Interaction | null> {
  const row = await findById(db, interactionId);
  if (row === null || row.user_id !== actorId) return null;
  return rowToInteraction(row);
}

export async function findInteractionBySource(
  db: SqlTx,
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
