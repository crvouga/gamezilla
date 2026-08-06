import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

export const SPACES_TABLE = defineTable({
  tableName: 'spaces',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'title', type: 'text' },
    { name: 'host_id', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'ended_at', type: 'text' },
    { name: 'visibility', type: 'text' },
    { name: 'host_account_id', type: 'text' },
    { name: 'host_member_id', type: 'text' },
  ],
});

export const SPACE_USERS_TABLE = defineTable({
  tableName: 'space_users',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'space_id', type: 'text' },
    { name: 'user_id', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'created_by_account_id', type: 'text' },
  ],
});

/**
 * Per-install open-space sessions (miniplayer + room lifetime).
 * Synced by `device_id`. Row `id` is `${deviceId}:${spaceId}`.
 */
export const SPACE_OPEN_SESSIONS_TABLE = defineTable({
  tableName: 'space_open_sessions',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'space_id', type: 'text' },
    { name: 'device_id', type: 'text' },
    { name: 'opened_at', type: 'text' },
    { name: 'join_announced', type: 'integer' },
  ],
});

export const ALL_SPACE_SYNC_TABLES = [
  SPACES_TABLE,
  SPACE_USERS_TABLE,
  SPACE_OPEN_SESSIONS_TABLE,
] as const;

/** Canonical space_users row id: `${spaceId}:${userId}`. */
export function spaceUserEntityId(spaceId: string, userId: string): string {
  return `${spaceId}:${userId}`;
}

/** Canonical space_open_sessions row id: `${deviceId}:${spaceId}`. */
export function spaceOpenSessionEntityId(
  deviceId: string,
  spaceId: string
): string {
  return `${deviceId}:${spaceId}`;
}
