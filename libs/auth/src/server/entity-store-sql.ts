import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TABLE,
  ENTITY_STORE_TYPE_USER,
  entityStoreId,
} from '@libs/db/shared/entity-store-table';
import { col, sqlMap } from '@pkgs/sql';
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
  const rows = await db.query<EntityStoreDataRow>(
    sqlMap({
      select: ['data'],
      from: ENTITY_STORE_TABLE,
      where: [
        'and',
        ['=', 'namespace', ENTITY_STORE_NAMESPACE_AUTH],
        ['=', 'type', ENTITY_STORE_TYPE_USER],
        ['=', 'owner_id', ownerId],
      ],
      limit: 1,
    })
  );
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
  await db.run(
    sqlMap({
      insertInto: ENTITY_STORE_TABLE,
      values: {
        id,
        namespace: ENTITY_STORE_NAMESPACE_AUTH,
        type: ENTITY_STORE_TYPE_USER,
        external_id: args.externalUserId,
        owner_id: args.ownerId,
        data: ['cast', JSON.stringify(args.data), 'jsonb'],
        created_at: now,
        updated_at: now,
      },
      onConflict: {
        target: ['namespace', 'type', 'external_id'],
        set: {
          owner_id: col('excluded.owner_id'),
          data: col('excluded.data'),
          updated_at: col('excluded.updated_at'),
        },
      },
    })
  );
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
