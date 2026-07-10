import { defineTable } from '@pkgs/sync-engine/shared/table-definition';
import { createTableRegistry } from '@pkgs/sync-engine/shared/table-registry';

import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
  USERS_TABLE,
  UserTableCol,
} from './external-accounts-tables';

export const DeviceCol = {
  id: 'id',
  userId: 'user_id',
  createdAt: 'created_at',
  platform: 'platform',
  osName: 'os_name',
  osVersion: 'os_version',
  deviceModelName: 'device_model_name',
  deviceBrand: 'device_brand',
  deviceName: 'device_name',
  appVersion: 'app_version',
  appBuildNumber: 'app_build_number',
  userAgent: 'user_agent',
  firstSeenAt: 'first_seen_at',
  lastSeenAt: 'last_seen_at',
} as const;

export const UserCol = UserTableCol;

export const AccountProviderCol = {
  id: 'id',
  accountId: 'account_id',
  provider: 'provider',
  providerUserId: 'provider_user_id',
  email: 'email',
  linkedAt: 'linked_at',
} as const;

export const DEVICES_TABLE = defineTable({
  tableName: 'devices',
  columns: [
    { name: DeviceCol.id, type: 'text', primaryKey: true },
    { name: DeviceCol.userId, type: 'text' },
    { name: DeviceCol.createdAt, type: 'text' },
    { name: DeviceCol.platform, type: 'text' },
    { name: DeviceCol.osName, type: 'text' },
    { name: DeviceCol.osVersion, type: 'text' },
    { name: DeviceCol.deviceModelName, type: 'text' },
    { name: DeviceCol.deviceBrand, type: 'text' },
    { name: DeviceCol.deviceName, type: 'text' },
    { name: DeviceCol.appVersion, type: 'text' },
    { name: DeviceCol.appBuildNumber, type: 'text' },
    { name: DeviceCol.userAgent, type: 'text' },
    { name: DeviceCol.firstSeenAt, type: 'text' },
    { name: DeviceCol.lastSeenAt, type: 'text' },
  ],
});

export const USERS_TABLE_DEF = defineTable({
  tableName: USERS_TABLE,
  columns: [
    { name: UserCol.id, type: 'text', primaryKey: true },
    { name: UserCol.createdAt, type: 'text' },
  ],
});

export const EXTERNAL_ACCOUNTS_TABLE_DEF = defineTable({
  tableName: EXTERNAL_ACCOUNTS_TABLE,
  columns: [
    { name: ExternalAccountCol.userId, type: 'text' },
    { name: ExternalAccountCol.provider, type: 'text' },
    { name: ExternalAccountCol.externalId, type: 'text' },
    { name: ExternalAccountCol.metadata, type: 'text' },
    { name: ExternalAccountCol.createdAt, type: 'text' },
  ],
});

export const AUTH_TABLE_DEFINITIONS = [
  DEVICES_TABLE,
  USERS_TABLE_DEF,
  EXTERNAL_ACCOUNTS_TABLE_DEF,
] as const;

export const AUTH_TABLE_REGISTRY = createTableRegistry(AUTH_TABLE_DEFINITIONS);

/** Writable device metadata columns accepted by `POST /auth/refresh`. */
export const DEVICE_SNAPSHOT_COLUMNS = new Set<string>([
  DeviceCol.platform,
  DeviceCol.osName,
  DeviceCol.osVersion,
  DeviceCol.deviceModelName,
  DeviceCol.deviceBrand,
  DeviceCol.deviceName,
  DeviceCol.appVersion,
  DeviceCol.appBuildNumber,
  DeviceCol.userAgent,
]);
