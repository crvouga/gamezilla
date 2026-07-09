import { useWatchValue } from '@pkgs/sync-engine/client/sync-engine-context';

import { DeviceCol, DEVICES_TABLE } from '../shared/auth-tables';

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

export function useDeviceColumn(
  deviceId: string,
  field: DeviceFieldKey
): string | null {
  const col = DeviceCol[field];
  const { value } = useWatchValue<string>(
    `SELECT ${col} AS value FROM ${DEVICES_TABLE.tableName} WHERE ${DeviceCol.id} = ?`,
    [deviceId]
  );
  return value;
}
