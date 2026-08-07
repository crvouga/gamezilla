export const SPACES_TABLE = 'spaces' as const;
export const SPACE_USERS_TABLE = 'space_users' as const;
export const SPACE_OPEN_SESSIONS_TABLE = 'space_open_sessions' as const;

export const SPACES_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "spaces" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "host_id" TEXT,
  "created_at" TEXT,
  "ended_at" TEXT,
  "visibility" TEXT,
  "host_account_id" TEXT,
  "host_member_id" TEXT
)
`;

export const SPACE_USERS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "space_users" (
  "id" TEXT PRIMARY KEY,
  "space_id" TEXT,
  "user_id" TEXT,
  "created_at" TEXT,
  "created_by_account_id" TEXT
)
`;

/**
 * Per-install open-space sessions (miniplayer + room lifetime).
 * Synced by `device_id`. Row `id` is `${deviceId}:${spaceId}`.
 */
export const SPACE_OPEN_SESSIONS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "space_open_sessions" (
  "id" TEXT PRIMARY KEY,
  "space_id" TEXT,
  "device_id" TEXT,
  "opened_at" TEXT,
  "join_announced" INTEGER
)
`;

export const ALL_SPACE_SYNC_TABLES = [
  SPACES_TABLE,
  SPACE_USERS_TABLE,
  SPACE_OPEN_SESSIONS_TABLE,
] as const;

export const ALL_SPACE_LOCAL_DDL = [
  SPACES_LOCAL_DDL,
  SPACE_USERS_LOCAL_DDL,
  SPACE_OPEN_SESSIONS_LOCAL_DDL,
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
