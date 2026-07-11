import type { SqlClient } from '@pkgs/sql-client/interface';

import type { Interaction } from '../shared/interaction';
import { buildInteractionId } from '../shared/interaction-id';
import { InboxError } from '../shared/inbox-errors';
import { rowToInteraction } from './row-mapper';
import {
  buildUpsertParams,
  findById,
  findBySource,
} from './publish-helpers';
import type {
  DeactivateInteractionInput,
  PublishInteractionInput,
  UpdateInteractionInput,
} from './types';

export async function publishInteraction(
  sql: SqlClient,
  input: PublishInteractionInput
): Promise<Interaction> {
  const now = new Date().toISOString();
  const params = buildUpsertParams(input, now);
  await sql.run(
    `INSERT INTO inbox_interactions (
      id, user_id, source_namespace, source_type, source_id,
      category, priority, group_key, title, subtitle, body,
      icon_key, avatar_fallback_label, avatar_config,
      deep_link_path, deep_link_params, actions, payload,
      expires_at, active, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?::jsonb, ?::jsonb, ?::jsonb,
      ?, ?, ?, ?
    )
    ON CONFLICT (id) DO UPDATE SET
      category = EXCLUDED.category,
      priority = EXCLUDED.priority,
      group_key = EXCLUDED.group_key,
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      body = EXCLUDED.body,
      icon_key = EXCLUDED.icon_key,
      avatar_fallback_label = EXCLUDED.avatar_fallback_label,
      avatar_config = EXCLUDED.avatar_config,
      deep_link_path = EXCLUDED.deep_link_path,
      deep_link_params = EXCLUDED.deep_link_params,
      actions = EXCLUDED.actions,
      payload = EXCLUDED.payload,
      expires_at = EXCLUDED.expires_at,
      active = true,
      updated_at = EXCLUDED.updated_at`,
    params
  );

  const row = await findById(sql, buildInteractionId(input.source, input.userId));
  if (row === null) {
    throw new InboxError('INBOX_NOT_FOUND', 'Interaction publish failed');
  }
  return rowToInteraction(row);
}

export async function updateInteraction(
  sql: SqlClient,
  input: UpdateInteractionInput
): Promise<Interaction> {
  return publishInteraction(sql, input);
}

export async function deactivateInteraction(
  sql: SqlClient,
  input: DeactivateInteractionInput
): Promise<void> {
  const now = new Date().toISOString();
  await sql.run(
    `UPDATE inbox_interactions
     SET active = false, updated_at = ?
     WHERE user_id = ?
       AND source_namespace = ?
       AND source_type = ?
       AND source_id = ?`,
    [
      now,
      input.userId,
      input.source.namespace,
      input.source.type,
      input.source.id,
    ]
  );
}

export async function findInteractionById(
  sql: SqlClient,
  actorId: string,
  interactionId: string
): Promise<Interaction | null> {
  const row = await findById(sql, interactionId);
  if (row === null || row.user_id !== actorId) return null;
  return rowToInteraction(row);
}

export async function findInteractionBySource(
  sql: SqlClient,
  lookup: { readonly userId: string; readonly source: PublishInteractionInput['source'] }
): Promise<Interaction | null> {
  const row = await findBySource(sql, {
    userId: lookup.userId,
    ...lookup.source,
  });
  if (row === null) return null;
  return rowToInteraction(row);
}

export { buildInteractionId, findById as findStoredInteractionById };
export type { PublishInteractionInput } from './types';
