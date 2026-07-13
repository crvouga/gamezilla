import type { SqlClient } from '@pkgs/sql-client/interface';

import { buildInteractionId } from '../shared/interaction-id';
import { assertBoundedPayload } from '../shared/payload-schema';
import type { InteractionSource } from '../shared/interaction-id';
import type { PublishInteractionInput, StoredInteractionRow } from './types';

type SourceLookup = InteractionSource & {
  readonly userId: string;
};

async function findById(
  sql: SqlClient,
  id: string
): Promise<StoredInteractionRow | null> {
  const rows = await sql.query<StoredInteractionRow>(
    `SELECT * FROM inbox_interactions WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

async function findBySource(
  sql: SqlClient,
  lookup: SourceLookup
): Promise<StoredInteractionRow | null> {
  const rows = await sql.query<StoredInteractionRow>(
    `SELECT * FROM inbox_interactions
     WHERE user_id = ?
       AND source_namespace = ?
       AND source_type = ?
       AND source_id = ?`,
    [lookup.userId, lookup.namespace, lookup.type, lookup.id]
  );
  return rows[0] ?? null;
}

function nullableString(value: string | undefined): string | null {
  return value ?? null;
}

function presentationTextColumns(input: PublishInteractionInput): unknown[] {
  const { presentation } = input;
  const avatar = presentation.avatar;
  const deepLink = presentation.deepLink;
  return [
    presentation.title,
    nullableString(presentation.subtitle),
    nullableString(presentation.body),
    nullableString(presentation.iconKey),
    avatar?.fallbackLabel ?? null,
    avatar?.avatarConfig ?? null,
    deepLink?.path ?? null,
    JSON.stringify(deepLink?.params ?? {}),
  ];
}

function buildUpsertParams(
  input: PublishInteractionInput,
  now: string
): unknown[] {
  const id = buildInteractionId(input.source, input.userId);
  const payload = assertBoundedPayload(input.payload);
  return [
    id,
    input.userId,
    input.source.namespace,
    input.source.type,
    input.source.id,
    input.category,
    input.priority ?? 0,
    input.groupKey ?? null,
    ...presentationTextColumns(input),
    JSON.stringify(input.actions),
    JSON.stringify(payload),
    input.expiresAt ?? null,
    true,
    now,
    now,
  ];
}

export { findById, findBySource, buildUpsertParams };
