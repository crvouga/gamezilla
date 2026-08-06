import { defineTable } from '@pkgs/sync-engine/shared/table-definition';
import { createTableRegistry } from '@pkgs/sync-engine/shared/table-registry';

import {
  EXTERNAL_ACCOUNTS_TABLE,
  USERS_TABLE,
} from './external-accounts-tables';

export const DEVICES_TABLE = defineTable({
  tableName: 'devices',
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'user_id', type: 'text' },
    { name: 'created_at', type: 'text' },
    { name: 'platform', type: 'text' },
    { name: 'os_name', type: 'text' },
    { name: 'os_version', type: 'text' },
    { name: 'device_model_name', type: 'text' },
    { name: 'device_brand', type: 'text' },
    { name: 'device_name', type: 'text' },
    { name: 'app_version', type: 'text' },
    { name: 'app_build_number', type: 'text' },
    { name: 'user_agent', type: 'text' },
    { name: 'first_seen_at', type: 'text' },
    { name: 'last_seen_at', type: 'text' },
  ],
});

export const USERS_TABLE_DEF = defineTable({
  tableName: USERS_TABLE,
  columns: [
    { name: 'id', type: 'text', primaryKey: true },
    { name: 'created_at', type: 'text' },
    // Postgres boolean → SQLite integer (0/1) via PowerSync.
    { name: 'is_anon', type: 'integer' },
  ],
});

export const EXTERNAL_ACCOUNTS_TABLE_DEF = defineTable({
  tableName: EXTERNAL_ACCOUNTS_TABLE,
  columns: [
    { name: 'user_id', type: 'text' },
    { name: 'provider', type: 'text' },
    { name: 'external_id', type: 'text' },
    { name: 'metadata', type: 'text' },
    { name: 'created_at', type: 'text' },
  ],
});

export const AUTH_TABLE_DEFINITIONS = [
  DEVICES_TABLE,
  USERS_TABLE_DEF,
  EXTERNAL_ACCOUNTS_TABLE_DEF,
] as const;

export const AUTH_TABLE_REGISTRY = createTableRegistry(AUTH_TABLE_DEFINITIONS);

/** Writable device metadata columns accepted by `POST /auth/refresh`. */
export const DEVICE_SNAPSHOT_COLUMNS = new Set([
  'platform',
  'os_name',
  'os_version',
  'device_model_name',
  'device_brand',
  'device_name',
  'app_version',
  'app_build_number',
  'user_agent',
]);
