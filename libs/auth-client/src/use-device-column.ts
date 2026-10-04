import sql from '@pkgs/sql-shared/sql';

import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

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
    FROM auth_devices
    WHERE id = ${deviceId}
  `;
}

export function useDeviceColumn(
  deviceId: Accessor<string>,
  field: DeviceFieldKey
): Accessor<string | null> {
  const column = DeviceField[field];
  const { rows } = createQuery(() => deviceRowByIdSql(deviceId()));
  return createMemo(() => {
    const row = rows()[0] ?? null;
    const value = row?.[column];
    return typeof value === 'string' ? value : null;
  });
}
