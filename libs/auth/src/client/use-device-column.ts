import { sql, ident } from '@pkgs/sql';
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
  return sql`SELECT ${ident(DeviceCol.id)},
      ${ident(DeviceCol.createdAt)},
      ${ident(DeviceCol.platform)},
      ${ident(DeviceCol.osName)},
      ${ident(DeviceCol.osVersion)},
      ${ident(DeviceCol.deviceModelName)},
      ${ident(DeviceCol.deviceBrand)},
      ${ident(DeviceCol.deviceName)},
      ${ident(DeviceCol.appVersion)},
      ${ident(DeviceCol.appBuildNumber)},
      ${ident(DeviceCol.userAgent)},
      ${ident(DeviceCol.firstSeenAt)},
      ${ident(DeviceCol.lastSeenAt)}
     FROM ${ident(DEVICES_TABLE.tableName)}
     WHERE ${ident(DeviceCol.id)} = ${deviceId}`;
}

export function useDeviceColumn(
  deviceId: string,
  field: DeviceFieldKey
): string | null {
  const col = DeviceCol[field];
  const { value } = useWatchField<string>(deviceRowByIdSql(deviceId), col);
  return value;
}
