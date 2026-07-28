import { raw, sql } from '@pkgs/sql';
import { useWatchField } from '@pkgs/sync-engine/client/sync-engine-context';

import { DeviceCol, DEVICES_TABLE } from '@libs/db/shared/auth-tables';

export const DeviceField = {
  id: 'id',
  createdAt: 'createdAt',
  platform: 'platform',
  osName: 'osName',
  osVersion: 'osVersion',
  deviceModelName: 'deviceModelName',
  deviceBrand: 'deviceBrand',
  deviceName: 'deviceName',
  appVersion: 'appVersion',
  appBuildNumber: 'appBuildNumber',
  userAgent: 'userAgent',
  firstSeenAt: 'firstSeenAt',
  lastSeenAt: 'lastSeenAt',
} as const satisfies Record<string, keyof typeof DeviceCol>;

export type DeviceFieldKey = keyof typeof DeviceField;

/** Canonical device row SELECT — all fields used by account-device atoms. */
function deviceRowByIdSql(deviceId: string) {
  return sql`SELECT ${raw(DeviceCol.id)},
      ${raw(DeviceCol.createdAt)},
      ${raw(DeviceCol.platform)},
      ${raw(DeviceCol.osName)},
      ${raw(DeviceCol.osVersion)},
      ${raw(DeviceCol.deviceModelName)},
      ${raw(DeviceCol.deviceBrand)},
      ${raw(DeviceCol.deviceName)},
      ${raw(DeviceCol.appVersion)},
      ${raw(DeviceCol.appBuildNumber)},
      ${raw(DeviceCol.userAgent)},
      ${raw(DeviceCol.firstSeenAt)},
      ${raw(DeviceCol.lastSeenAt)}
     FROM ${raw(DEVICES_TABLE.tableName)}
     WHERE ${raw(DeviceCol.id)} = ${deviceId}`;
}

export function useDeviceColumn(
  deviceId: string,
  field: DeviceFieldKey
): string | null {
  const col = DeviceCol[field];
  const { value } = useWatchField<string>(deviceRowByIdSql(deviceId), col);
  return value;
}
