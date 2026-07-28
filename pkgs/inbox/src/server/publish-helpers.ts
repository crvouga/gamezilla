import { sql, type Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { buildInteractionId } from '../shared/interaction-id';
import { assertBoundedPayload } from '../shared/payload-schema';
import type { InteractionSource } from '../shared/interaction-id';
import type { PublishInteractionInput, StoredInteractionRow } from './types';

type SourceLookup = InteractionSource & {
  readonly userId: string;
};

async function findById(
  db: SqlClient,
  id: string
): Promise<StoredInteractionRow | null> {
  const rows = await db.query<StoredInteractionRow>(
    sql`SELECT * FROM inbox_interactions WHERE id = ${id}`
  );
  return rows[0] ?? null;
}

async function findBySource(
  db: SqlClient,
  lookup: SourceLookup
): Promise<StoredInteractionRow | null> {
  const rows = await db.query<StoredInteractionRow>(sql`
    SELECT * FROM inbox_interactions
     WHERE user_id = ${lookup.userId}
       AND source_namespace = ${lookup.namespace}
       AND source_type = ${lookup.type}
       AND source_id = ${lookup.id}`);
  return rows[0] ?? null;
}

function nullableString(value: string | undefined): string | null {
  return value ?? null;
}

function upsertInteractionSql(
  input: PublishInteractionInput,
  now: string
): Sql {
  const id = buildInteractionId(input.source, input.userId);
  const payload = assertBoundedPayload(input.payload);
  const { presentation } = input;
  const avatar = presentation.avatar;
  const deepLink = presentation.deepLink;

  return sql`
    INSERT INTO inbox_interactions (
      id, user_id, source_namespace, source_type, source_id,
      category, priority, group_key, title, subtitle, body,
      icon_key, avatar_fallback_label, avatar_config,
      deep_link_path, deep_link_params, actions, payload,
      expires_at, active, created_at, updated_at
    ) VALUES (
      ${id}, ${input.userId}, ${input.source.namespace}, ${input.source.type}, ${input.source.id},
      ${input.category}, ${input.priority ?? 0}, ${input.groupKey ?? null},
      ${presentation.title}, ${nullableString(presentation.subtitle)}, ${nullableString(presentation.body)},
      ${nullableString(presentation.iconKey)}, ${avatar?.fallbackLabel ?? null}, ${avatar?.avatarConfig ?? null},
      ${deepLink?.path ?? null}, ${JSON.stringify(deepLink?.params ?? {})}::jsonb,
      ${JSON.stringify(input.actions)}::jsonb, ${JSON.stringify(payload)}::jsonb,
      ${input.expiresAt ?? null}, ${true}, ${now}, ${now}
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
      updated_at = EXCLUDED.updated_at`;
}

export { findById, findBySource, upsertInteractionSql };
