import {
  ENTITY_STORE_NAMESPACE_STRIPE,
  ENTITY_STORE_TABLE,
  entityStoreId,
} from '@pkgs/sync-engine/shared/entity-store';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  patchEntityTypeToEntityStoreType,
  stripeEntityStoreData,
} from './entity-store-helpers';

type EntityStoreDataRow = { readonly data: unknown };

export async function readEntityStoreData(
  sql: SqlClient,
  args: {
    readonly namespace: string;
    readonly type: string;
    readonly externalId: string;
  }
): Promise<Record<string, unknown> | null> {
  const rows = await sql.query<EntityStoreDataRow>(
    `SELECT data FROM ${ENTITY_STORE_TABLE}
     WHERE namespace = ? AND type = ? AND external_id = ? LIMIT 1`,
    [args.namespace, args.type, args.externalId]
  );
  const raw = rows[0]?.data;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  return null;
}

export async function upsertEntityStoreRow(
  sql: SqlClient,
  args: {
    readonly namespace: string;
    readonly type: string;
    readonly externalId: string;
    readonly ownerId?: string | null;
    readonly data: Record<string, unknown>;
  }
): Promise<void> {
  const id = entityStoreId(args.namespace, args.type, args.externalId);
  const now = new Date().toISOString();
  const dataJson = stripeEntityStoreData(args.data);
  await sql.run(
    `INSERT INTO ${ENTITY_STORE_TABLE}
     (id, namespace, type, external_id, owner_id, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?)
     ON CONFLICT (namespace, type, external_id) DO UPDATE SET
       owner_id = COALESCE(excluded.owner_id, ${ENTITY_STORE_TABLE}.owner_id),
       data = excluded.data,
       updated_at = excluded.updated_at`,
    [
      id,
      args.namespace,
      args.type,
      args.externalId,
      args.ownerId ?? null,
      dataJson,
      now,
      now,
    ]
  );
}

export async function upsertStripeEntityStoreRow(
  sql: SqlClient,
  args: {
    readonly patchEntityType: string;
    readonly externalId: string;
    readonly ownerId?: string | null;
    readonly data: Record<string, unknown>;
  }
): Promise<void> {
  await upsertEntityStoreRow(sql, {
    namespace: ENTITY_STORE_NAMESPACE_STRIPE,
    type: patchEntityTypeToEntityStoreType(args.patchEntityType),
    externalId: args.externalId,
    ...(args.ownerId !== undefined ? { ownerId: args.ownerId } : {}),
    data: args.data,
  });
}

export async function readStripeEntityStoreData(
  sql: SqlClient,
  args: {
    readonly patchEntityType: string;
    readonly externalId: string;
  }
): Promise<Record<string, unknown> | null> {
  return readEntityStoreData(sql, {
    namespace: ENTITY_STORE_NAMESPACE_STRIPE,
    type: patchEntityTypeToEntityStoreType(args.patchEntityType),
    externalId: args.externalId,
  });
}
