import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TABLE,
  ENTITY_STORE_TYPE_USER,
  entityStoreId,
} from '@libs/db/shared/entity-store-table';
import { sql, ident } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

type EntityStoreDataRow = { readonly data: unknown };

function parseEntityStoreData(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

export async function readAuthUserEntityData(
  db: SqlClient,
  ownerId: string
): Promise<Record<string, unknown> | null> {
  const rows = await db.query<EntityStoreDataRow>(sql`
    SELECT data FROM ${ident(ENTITY_STORE_TABLE)}
    WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH} AND type = ${ENTITY_STORE_TYPE_USER} AND owner_id = ${ownerId}
    LIMIT 1
  `);
  return parseEntityStoreData(rows[0]?.data);
}

export async function upsertAuthUserSnapshot(
  db: SqlClient,
  args: {
    readonly externalUserId: string;
    readonly ownerId: string;
    readonly data: Record<string, unknown>;
  }
): Promise<void> {
  const id = entityStoreId(
    ENTITY_STORE_NAMESPACE_AUTH,
    ENTITY_STORE_TYPE_USER,
    args.externalUserId
  );
  const now = new Date().toISOString();
  await db.run(sql`
    INSERT INTO ${ident(ENTITY_STORE_TABLE)}
    (id, namespace, type, external_id, owner_id, data, created_at, updated_at)
    VALUES (${id}, ${ENTITY_STORE_NAMESPACE_AUTH}, ${ENTITY_STORE_TYPE_USER}, ${args.externalUserId}, ${args.ownerId}, ${JSON.stringify(args.data)}::jsonb, ${now}, ${now})
    ON CONFLICT (namespace, type, external_id) DO UPDATE SET
      owner_id = excluded.owner_id,
      data = excluded.data,
      updated_at = excluded.updated_at
  `);
}

/** Primary email from a serialized auth-provider user payload. */
export function readPrimaryEmailFromAuthSnapshot(
  data: Record<string, unknown>
): string | null {
  const primaryId = data['primary_email_address_id'];
  const addresses = data['email_addresses'];
  if (typeof primaryId !== 'string' || !Array.isArray(addresses)) {
    return null;
  }
  for (const entry of addresses) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (row['id'] !== primaryId) continue;
    const email = row['email_address'];
    return typeof email === 'string' && email.length > 0 ? email : null;
  }
  return null;
}
