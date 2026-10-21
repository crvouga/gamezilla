import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';

export const ENTITY_STORE_TABLE = 'entity_store';

/**
 * Backend-only third-party JSON mirror. Not in product appSchema (not synced).
 * Soft-delete via managed `deleted_at`.
 */
export const entityStoreTable = defineTable({
  domain: 'entity_store',
  name: 'entity_store',
  columns: {
    namespace: 'text',
    type: 'text',
    external_id: 'text',
    owner_id: 'text',
    data: 'json',
  },
  indexes: [
    ['namespace', 'owner_id'],
    ['namespace', 'type'],
  ],
  uniqueIndexes: [['namespace', 'type', 'external_id']],
});

export const entityStoreSchema = registerTables([entityStoreTable]);
