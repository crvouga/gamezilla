export const INBOX_INTERACTIONS_TABLE = 'inbox_interactions' as const;
export const INBOX_PREFERENCES_TABLE = 'inbox_preferences' as const;

export const INBOX_INTERACTIONS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "inbox_interactions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT,
  "source_namespace" TEXT,
  "source_type" TEXT,
  "source_id" TEXT,
  "category" TEXT,
  "priority" INTEGER,
  "group_key" TEXT,
  "title" TEXT,
  "subtitle" TEXT,
  "icon_key" TEXT,
  "avatar_fallback_label" TEXT,
  "avatar_config" TEXT,
  "deep_link_path" TEXT,
  "deep_link_params" TEXT,
  "actions" TEXT,
  "payload" TEXT,
  "expires_at" TEXT,
  "read_at" TEXT,
  "archived_at" TEXT,
  "dismissed_at" TEXT,
  "active" INTEGER,
  "created_at" TEXT,
  "updated_at" TEXT
)
`;

export const INBOX_PREFERENCES_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "inbox_preferences" (
  "user_id" TEXT PRIMARY KEY,
  "preferences" TEXT,
  "updated_at" TEXT
)
`;

export const ALL_INBOX_SYNC_TABLES = [
  INBOX_INTERACTIONS_TABLE,
  INBOX_PREFERENCES_TABLE,
] as const;

export const ALL_INBOX_LOCAL_DDL = [
  INBOX_INTERACTIONS_LOCAL_DDL,
  INBOX_PREFERENCES_LOCAL_DDL,
] as const;
