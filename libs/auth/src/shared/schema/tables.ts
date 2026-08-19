import { defineTable } from '@pkgs/db-schema';

export const authUsers = defineTable({
  domain: 'auth',
  name: 'auth_users',
  columns: {
    is_anon: 'boolean',
  },
});

export const authDevices = defineTable({
  domain: 'auth',
  name: 'auth_devices',
  columns: {
    platform: 'text',
    os_name: 'text',
    os_version: 'text',
    device_model_name: 'text',
    device_brand: 'text',
    device_name: 'text',
    app_version: 'text',
    app_build_number: 'text',
    user_agent: 'text',
    first_seen_at: 'timestamp',
    last_seen_at: 'timestamp',
    account_id: 'text',
    user_id: 'text',
  },
  indexes: ['account_id', 'user_id'],
});

export const authExternalAccounts = defineTable({
  domain: 'auth',
  name: 'auth_external_accounts',
  columns: {
    user_id: 'text',
    provider: 'text',
    external_id: 'text',
    metadata: 'json',
  },
  indexes: ['user_id'],
  uniqueIndexes: [
    ['provider', 'external_id'],
    ['user_id', 'provider'],
  ],
});

export const AUTH_TABLES = [
  authUsers,
  authDevices,
  authExternalAccounts,
] as const;
