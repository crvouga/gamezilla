export const FRIEND_REQUESTS_TABLE = 'friend_requests' as const;
export const FRIENDSHIPS_TABLE = 'friendships' as const;
export const USER_BLOCKS_TABLE = 'user_blocks' as const;

export const FRIEND_REQUESTS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "friend_requests" (
  "id" TEXT PRIMARY KEY,
  "from_user_id" TEXT,
  "to_user_id" TEXT,
  "status" TEXT,
  "message" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT,
  "responded_at" TEXT
)
`;

export const FRIENDSHIPS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "friendships" (
  "id" TEXT PRIMARY KEY,
  "user_low" TEXT,
  "user_high" TEXT,
  "created_at" TEXT,
  "source_request_id" TEXT
)
`;

export const USER_BLOCKS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "user_blocks" (
  "id" TEXT PRIMARY KEY,
  "blocker_id" TEXT,
  "blocked_id" TEXT,
  "created_at" TEXT
)
`;

export const ALL_FRIENDS_SYNC_TABLES = [
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  USER_BLOCKS_TABLE,
] as const;

export const ALL_FRIENDS_LOCAL_DDL = [
  FRIEND_REQUESTS_LOCAL_DDL,
  FRIENDSHIPS_LOCAL_DDL,
  USER_BLOCKS_LOCAL_DDL,
] as const;
