import { sql } from '@pkgs/sql';

import { useQueryField } from '@pkgs/sync-engine/client/sync-engine-context';

export const DeviceField = {
  id: 'id',
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

export type DeviceFieldKey = keyof typeof DeviceField;

type DeviceRow = {
  readonly id: string;
  readonly created_at: string;
  readonly platform: string;
  readonly os_name: string;
  readonly os_version: string;
  readonly device_model_name: string;
  readonly device_brand: string;
  readonly device_name: string;
  readonly app_version: string;
  readonly app_build_number: string;
  readonly user_agent: string;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
};

/** Canonical device row SELECT — all fields used by account-device atoms. */
function deviceRowByIdSql(deviceId: string) {
  return sql<DeviceRow>`
    SELECT
      id,
      created_at,
      platform,
      os_name,
      os_version,
      device_model_name,
      device_brand,
      device_name,
      app_version,
      app_build_number,
      user_agent,
      first_seen_at,
      last_seen_at
    FROM devices
    WHERE id = ${deviceId}
  `;
}

export function useDeviceColumn(
  deviceId: string,
  field: DeviceFieldKey
): string | null {
  const column = DeviceField[field];
  const { value } = useQueryField(deviceRowByIdSql(deviceId), column);
  return value;
}
