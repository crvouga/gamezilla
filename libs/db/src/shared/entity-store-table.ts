import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

/** Composite id for rows in the generic third-party mirror table. */
export function entityStoreId(
  namespace: string,
  type: string,
  externalId: string
): string {
  return `${namespace}/${type}/${externalId}`;
}

export type EntityStoreRow = {
  readonly id: string;
  readonly namespace: string;
  readonly type: string;
  readonly external_id: string;
  readonly owner_id: string | null;
  readonly data: unknown;
  readonly created_at: string;
  readonly updated_at: string;
};

export const ENTITY_STORE_TABLE = 'entity_store' as const;

export const ENTITY_STORE_NAMESPACE_STRIPE = 'stripe' as const;
export const ENTITY_STORE_NAMESPACE_AUTH = 'auth' as const;
export const ENTITY_STORE_TYPE_USER = 'user' as const;

/** Generic JSONB mirror table for third-party and extension entity types. */
export const ENTITY_STORE_TABLE_DEF = defineTable({
  tableName: ENTITY_STORE_TABLE,
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'namespace', type: 'text' },
    { name: 'type', type: 'text' },
    { name: 'external_id', type: 'text' },
    { name: 'owner_id', type: 'text' },
    { name: 'data', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'updated_at', type: 'text' },
  ],
});
