import { defineTable } from '@pkgs/db-schema-root-shared/define-table';

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
  uniqueIndexes: [
    ['provider', 'external_id'],
    ['user_id', 'provider'],
  ],
});

/**
 * A device's time in an account: live while it is signed in there,
 * tombstoned when it leaves. `auth_devices.user_id` moves with the install,
 * so this is how the account it left hears that it left.
 */
export const authAccountDevices = defineTable({
  domain: 'auth',
  name: 'auth_account_devices',
  columns: {
    user_id: 'text',
    device_id: 'text',
  },
  uniqueIndexes: [['user_id', 'device_id']],
});

export const AUTH_TABLES = [
  authUsers,
  authDevices,
  authExternalAccounts,
  authAccountDevices,
] as const;
