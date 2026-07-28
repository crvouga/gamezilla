import {
  ENTITY_STORE_NAMESPACE_STRIPE,
  ENTITY_STORE_TABLE,
  entityStoreId,
} from '@libs/db/shared/entity-store-table';
import { sql, ident } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  patchEntityTypeToEntityStoreType,
  stripeEntityStoreData,
} from './entity-store-helpers';

type EntityStoreDataRow = { readonly data: unknown };

export async function readEntityStoreData(
  db: SqlClient,
  args: {
    readonly namespace: string;
    readonly type: string;
    readonly externalId: string;
  }
): Promise<Record<string, unknown> | null> {
  const rows = await db.query<EntityStoreDataRow>(sql`
    SELECT data FROM ${ident(ENTITY_STORE_TABLE)}
     WHERE namespace = ${args.namespace} AND type = ${args.type} AND external_id = ${args.externalId} LIMIT 1
  `);
  const data = rows[0]?.data;
  if (data === null || data === undefined) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof data === 'object') {
    return data as Record<string, unknown>;
  }
  return null;
}

export async function upsertEntityStoreRow(
  db: SqlClient,
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
  await db.run(sql`
    INSERT INTO ${ident(ENTITY_STORE_TABLE)}
     (id, namespace, type, external_id, owner_id, data, created_at, updated_at)
     VALUES (${id}, ${args.namespace}, ${args.type}, ${args.externalId}, ${args.ownerId ?? null}, ${dataJson}::jsonb, ${now}, ${now})
     ON CONFLICT (namespace, type, external_id) DO UPDATE SET
       owner_id = COALESCE(excluded.owner_id, ${ident(ENTITY_STORE_TABLE)}.owner_id),
       data = excluded.data,
       updated_at = excluded.updated_at
  `);
}

export async function upsertStripeEntityStoreRow(
  db: SqlClient,
  args: {
    readonly patchEntityType: string;
    readonly externalId: string;
    readonly ownerId?: string | null;
    readonly data: Record<string, unknown>;
  }
): Promise<void> {
  await upsertEntityStoreRow(db, {
    namespace: ENTITY_STORE_NAMESPACE_STRIPE,
    type: patchEntityTypeToEntityStoreType(args.patchEntityType),
    externalId: args.externalId,
    ...(args.ownerId !== undefined ? { ownerId: args.ownerId } : {}),
    data: args.data,
  });
}

export async function readStripeEntityStoreData(
  db: SqlClient,
  args: {
    readonly patchEntityType: string;
    readonly externalId: string;
  }
): Promise<Record<string, unknown> | null> {
  return readEntityStoreData(db, {
    namespace: ENTITY_STORE_NAMESPACE_STRIPE,
    type: patchEntityTypeToEntityStoreType(args.patchEntityType),
    externalId: args.externalId,
  });
}
