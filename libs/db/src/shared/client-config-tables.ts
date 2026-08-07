export const CLIENT_CONFIG_TABLE = 'client_config' as const;

export const CLIENT_CONFIG_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "client_config" (
  "id" TEXT PRIMARY KEY,
  "google_web_client_id" TEXT
)
`;

export const ALL_CLIENT_CONFIG_SYNC_TABLES = [CLIENT_CONFIG_TABLE] as const;

export const ALL_CLIENT_CONFIG_LOCAL_DDL = [CLIENT_CONFIG_LOCAL_DDL] as const;
