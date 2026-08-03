import { sql } from '@pkgs/sql';

import { useWatchField } from '@pkgs/sync-engine/client/sync-engine-context';

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

/** Canonical device row SELECT — all fields used by account-device atoms. */
function deviceRowByIdSql(deviceId: string) {
  return sql`
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
  const { value } = useWatchField<string>(deviceRowByIdSql(deviceId), column);
  return value;
}
