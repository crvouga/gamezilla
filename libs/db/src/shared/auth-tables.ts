import {
  EXTERNAL_ACCOUNTS_TABLE,
  USERS_TABLE,
} from './external-accounts-tables';

export const DEVICES_TABLE = 'devices' as const;

export const DEVICES_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "devices" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT,
  "created_at" TEXT,
  "platform" TEXT,
  "os_name" TEXT,
  "os_version" TEXT,
  "device_model_name" TEXT,
  "device_brand" TEXT,
  "device_name" TEXT,
  "app_version" TEXT,
  "app_build_number" TEXT,
  "user_agent" TEXT,
  "first_seen_at" TEXT,
  "last_seen_at" TEXT
)
`;

export const USERS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "created_at" TEXT,
  "is_anon" INTEGER
)
`;

export const EXTERNAL_ACCOUNTS_LOCAL_DDL = `
CREATE TABLE IF NOT EXISTS "external_accounts" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT,
  "provider" TEXT,
  "external_id" TEXT,
  "metadata" TEXT,
  "created_at" TEXT
)
`;

export const AUTH_TABLE_NAMES = [
  DEVICES_TABLE,
  USERS_TABLE,
  EXTERNAL_ACCOUNTS_TABLE,
] as const;

export const AUTH_LOCAL_DDL = [
  DEVICES_LOCAL_DDL,
  USERS_LOCAL_DDL,
  EXTERNAL_ACCOUNTS_LOCAL_DDL,
] as const;

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
