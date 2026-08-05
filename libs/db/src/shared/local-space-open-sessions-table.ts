import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

/**
 * Device-local open-space sessions (miniplayer + room lifetime).
 * PowerSync `localOnly` — never uploaded. Row `id` is the space id.
 */
export const LOCAL_SPACE_OPEN_SESSIONS_TABLE = defineTable({
  tableName: 'local_space_open_sessions',
  localOnly: true,
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'opened_at', type: 'text' },
    { name: 'client_id', type: 'text' },
    { name: 'join_announced', type: 'integer' },
  ],
});

export const ALL_LOCAL_SPACE_TABLES = [
  LOCAL_SPACE_OPEN_SESSIONS_TABLE,
] as const;
