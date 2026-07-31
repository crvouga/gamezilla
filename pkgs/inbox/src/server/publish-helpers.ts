import {
  col,
  sqlMap,
  type ColRef,
  type OpCall,
  type Scalar,
  type Sql,
} from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { InteractionSource } from '../shared/interaction-id';
import { buildInteractionId } from '../shared/interaction-id';
import { assertBoundedPayload } from '../shared/payload-schema';
import type { PublishInteractionInput, StoredInteractionRow } from './types';

type SourceLookup = InteractionSource & {
  readonly userId: string;
};

async function findById(
  db: SqlClient,
  id: string
): Promise<StoredInteractionRow | null> {
  const rows = await db.query<StoredInteractionRow>(
    sqlMap({
      select: ['*'],
      from: 'inbox_interactions',
      where: ['=', 'id', id],
    })
  );
  return rows[0] ?? null;
}

async function findBySource(
  db: SqlClient,
  lookup: SourceLookup
): Promise<StoredInteractionRow | null> {
  const rows = await db.query<StoredInteractionRow>(
    sqlMap({
      select: ['*'],
      from: 'inbox_interactions',
      where: [
        'and',
        ['=', 'user_id', lookup.userId],
        ['=', 'source_namespace', lookup.namespace],
        ['=', 'source_type', lookup.type],
        ['=', 'source_id', lookup.id],
      ],
    })
  );
  return rows[0] ?? null;
}

function nullableString(value: string | undefined): string | null {
  return value ?? null;
}

type InteractionInsertValues = Readonly<
  Record<string, Scalar | ColRef | OpCall>
>;

function avatarInsertValues(
  presentation: PublishInteractionInput['presentation']
): InteractionInsertValues {
  const avatar = presentation.avatar;
  return {
    avatar_fallback_label: avatar?.fallbackLabel ?? null,
    avatar_config: avatar?.avatarConfig ?? null,
  };
}

function deepLinkInsertValues(
  presentation: PublishInteractionInput['presentation']
): InteractionInsertValues {
  const deepLink = presentation.deepLink;
  return {
    deep_link_path: deepLink?.path ?? null,
    deep_link_params: ['cast', JSON.stringify(deepLink?.params ?? {}), 'jsonb'],
  };
}

function upsertInteractionValues(
  input: PublishInteractionInput,
  now: string
): InteractionInsertValues {
  const id = buildInteractionId(input.source, input.userId);
  const payload = assertBoundedPayload(input.payload);
  const { presentation } = input;
  return {
    id,
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
    actions: ['cast', JSON.stringify(input.actions), 'jsonb'],
    payload: ['cast', JSON.stringify(payload), 'jsonb'],
    expires_at: input.expiresAt ?? null,
    active: true,
    created_at: now,
    updated_at: now,
  };
}

function upsertInteractionSql(
  input: PublishInteractionInput,
  now: string
): Sql {
  return sqlMap({
    insertInto: 'inbox_interactions',
    values: upsertInteractionValues(input, now),
    onConflict: {
      target: ['id'],
      set: {
        category: col('excluded.category'),
        priority: col('excluded.priority'),
        group_key: col('excluded.group_key'),
        title: col('excluded.title'),
        subtitle: col('excluded.subtitle'),
        body: col('excluded.body'),
        icon_key: col('excluded.icon_key'),
        avatar_fallback_label: col('excluded.avatar_fallback_label'),
        avatar_config: col('excluded.avatar_config'),
        deep_link_path: col('excluded.deep_link_path'),
        deep_link_params: col('excluded.deep_link_params'),
        actions: col('excluded.actions'),
        payload: col('excluded.payload'),
        expires_at: col('excluded.expires_at'),
        active: true,
        updated_at: col('excluded.updated_at'),
      },
    },
  });
}

export { findById, findBySource, upsertInteractionSql };
