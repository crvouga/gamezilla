import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

/** Client-insert mutation log. Uploads; does not sync down. */
export const MUTATIONS_TABLE = defineTable({
  tableName: '_mutations',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'name', type: 'text' },
    { name: 'args', type: 'text' },
    { name: 'client_id', type: 'text' },
    { name: 'seq', type: 'integer' },
    { name: 'created_at', type: 'text' },
  ],
});

/**
 * Server-only idempotency / audit. Never on the client schema.
 * Defined here for documentation + server DDL alignment only.
 */
export const MUTATIONS_APPLIED_TABLE_NAME = '_mutations_applied' as const;

/** Server-authored rejections synced down by client_id (= device_id). */
export const WRITE_REJECTIONS_TABLE = defineTable({
  tableName: 'write_rejections',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'mutation_id', type: 'text' },
    { name: 'client_id', type: 'text' },
    { name: 'code', type: 'text' },
    { name: 'message', type: 'text' },
    { name: 'meta', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'acknowledged', type: 'integer' },
  ],
});

export const ALL_MUTATION_SYNC_TABLES = [
  MUTATIONS_TABLE,
  WRITE_REJECTIONS_TABLE,
] as const;
