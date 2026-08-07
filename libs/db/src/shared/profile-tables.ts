export const PROFILES_TABLE = 'profiles' as const;

export const PROFILES_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT,
  "username" TEXT,
  "username_changed_at" TEXT,
  "avatar_config" TEXT
)
`;

export const ALL_PROFILE_SYNC_TABLES = [PROFILES_TABLE] as const;

export const ALL_PROFILE_LOCAL_DDL = [PROFILES_LOCAL_DDL] as const;
