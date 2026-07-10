import { defineTable } from '@pkgs/sync-engine/shared/table-definition';

export const ClientConfigCol = {
  id: 'id',
  googleWebClientId: 'google_web_client_id',
} as const;

export const CLIENT_CONFIG_TABLE = defineTable({
  tableName: 'client_config',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'google_web_client_id', type: 'text' },
  ],
});

export const ALL_CLIENT_CONFIG_SYNC_TABLES = [CLIENT_CONFIG_TABLE] as const;
