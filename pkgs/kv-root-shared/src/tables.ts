import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';

export const KV_TABLE = 'kv';

/**
 * Backend key/value store. Not in product appSchema (not synced).
 * Business key is `key` (unique); managed `id` equals `key` on insert.
 */
export const kvTable = defineTable({
  domain: 'kv',
  name: 'kv',
  columns: {
    key: 'text',
    value: 'json',
  },
  uniqueIndexes: ['key'],
});

export const kvSchema = registerTables([kvTable]);
