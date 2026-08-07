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
export const ENTITY_STORE_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "entity_store" (
  "id" TEXT PRIMARY KEY,
  "namespace" TEXT,
  "type" TEXT,
  "external_id" TEXT,
  "owner_id" TEXT,
  "data" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
)
`;
