import { type Sql, sql } from '@pkgs/sql';

import type { SqlTx } from '@pkgs/sql-client/interface';
import { managedInsertColumns } from '@pkgs/sync-engine/shared';
import type { CreateId } from '@pkgs/uuid';

import type { InteractionSource } from '../shared/interaction-id';
import { buildInteractionId } from '../shared/interaction-id';
import { assertBoundedPayload } from '../shared/payload-schema';
import type { PublishInteractionInput, StoredInteractionRow } from './types';

type SourceLookup = InteractionSource & {
  readonly userId: string;
};

async function findById(
  db: SqlTx,
  id: string
): Promise<StoredInteractionRow | null> {
  const rows = await db.query(
    sql<StoredInteractionRow>`SELECT * FROM inbox_interactions WHERE id = ${id}`
  );
  return rows[0] ?? null;
}

async function findBySource(
  db: SqlTx,
  lookup: SourceLookup
): Promise<StoredInteractionRow | null> {
  const rows = await db.query(
    sql<StoredInteractionRow>`
      SELECT *
        FROM inbox_interactions
       WHERE user_id = ${lookup.userId}
         AND source_namespace = ${lookup.namespace}
         AND source_type = ${lookup.type}
         AND source_id = ${lookup.id}`
  );
  return rows[0] ?? null;
}

function nullableString(value: string | undefined): string | null {
  return value ?? null;
}

function avatarInsertValues(
  presentation: PublishInteractionInput['presentation']
): Pick<InteractionInsertValues, 'avatar_fallback_label' | 'avatar_config'> {
  const avatar = presentation.avatar;
  return {
    avatar_fallback_label: avatar?.fallbackLabel ?? null,
    avatar_config: avatar?.avatarConfig ?? null,
  };
}

function deepLinkInsertValues(
  presentation: PublishInteractionInput['presentation']
): Pick<InteractionInsertValues, 'deep_link_path' | 'deep_link_params'> {
  const deepLink = presentation.deepLink;
  return {
    deep_link_path: deepLink?.path ?? null,
    deep_link_params: JSON.stringify(deepLink?.params ?? {}),
  };
}

type InteractionInsertValues = {
  readonly id: string;
  readonly user_id: string;
  readonly source_namespace: string;
  readonly source_type: string;
  readonly source_id: string;
  readonly category: string;
  readonly priority: number;
  readonly group_key: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly body: string | null;
  readonly icon_key: string | null;
  readonly avatar_fallback_label: string | null;
  readonly avatar_config: string | null;
  readonly deep_link_path: string | null;
  readonly deep_link_params: string;
  readonly actions: string;
  readonly payload: string;
  readonly expires_at: string | null;
  readonly active: number;
  readonly created_at: string;
  readonly updated_at: string;
};

function upsertInteractionValues(
  input: PublishInteractionInput,
  now: () => number,
  createId: CreateId
): InteractionInsertValues {
  const id = buildInteractionId(input.source, input.userId);
  const managed = managedInsertColumns(createId, now, id);
  const payload = assertBoundedPayload(input.payload);
  const { presentation } = input;
  return {
    id: managed.id,
    user_id: input.userId,
    source_namespace: input.source.namespace,
    source_type: input.source.type,
    source_id: input.source.id,
    category: input.category,
    priority: input.priority ?? 0,
    group_key: input.groupKey ?? null,
    title: presentation.title,
    subtitle: nullableString(presentation.subtitle),
    body: nullableString(presentation.body),
    icon_key: nullableString(presentation.iconKey),
    ...avatarInsertValues(presentation),
    ...deepLinkInsertValues(presentation),
    actions: JSON.stringify(input.actions),
    payload: JSON.stringify(payload),
    expires_at: input.expiresAt ?? null,
    active: 1,
    created_at: managed.created_at,
    updated_at: managed.updated_at,
  };
}

function upsertInteractionSql(
  input: PublishInteractionInput,
  now: () => number,
  createId: CreateId
): Sql {
  const values = upsertInteractionValues(input, now, createId);
  return sql<void>`
    INSERT INTO inbox_interactions (
      id, user_id, source_namespace, source_type, source_id, category,
      priority, group_key, title, subtitle, body, icon_key,
      avatar_fallback_label, avatar_config, deep_link_path, deep_link_params,
      actions, payload, expires_at, active, created_at, updated_at
    )
    VALUES (
      ${values.id}, ${values.user_id}, ${values.source_namespace},
      ${values.source_type}, ${values.source_id}, ${values.category},
      ${values.priority}, ${values.group_key}, ${values.title}, ${values.subtitle},
      ${values.body}, ${values.icon_key}, ${values.avatar_fallback_label},
      ${values.avatar_config}, ${values.deep_link_path},
      ${values.deep_link_params}, ${values.actions},
      ${values.payload}, ${values.expires_at}, ${values.active},
      ${values.created_at}, ${values.updated_at}
    )
    ON CONFLICT (id) DO UPDATE SET
      category = excluded.category,
      priority = excluded.priority,
      group_key = excluded.group_key,
      title = excluded.title,
      subtitle = excluded.subtitle,
      body = excluded.body,
      icon_key = excluded.icon_key,
      avatar_fallback_label = excluded.avatar_fallback_label,
      avatar_config = excluded.avatar_config,
      deep_link_path = excluded.deep_link_path,
      deep_link_params = excluded.deep_link_params,
      actions = excluded.actions,
      payload = excluded.payload,
      expires_at = excluded.expires_at,
      active = 1,
      updated_at = excluded.updated_at`;
}

export { findById, findBySource, upsertInteractionSql };
