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
export const DEVICE_ROW_BY_ID_SQL = `SELECT ${DeviceCol.id}, ${DeviceCol.createdAt},
            ${DeviceCol.platform}, ${DeviceCol.osName}, ${DeviceCol.osVersion},
            ${DeviceCol.deviceModelName}, ${DeviceCol.deviceBrand}, ${DeviceCol.deviceName},
            ${DeviceCol.appVersion}, ${DeviceCol.appBuildNumber}, ${DeviceCol.userAgent},
            ${DeviceCol.firstSeenAt}, ${DeviceCol.lastSeenAt}
     FROM ${DEVICES_TABLE.tableName}
     WHERE ${DeviceCol.id} = ?`;

export function useDeviceColumn(
  deviceId: string,
  field: DeviceFieldKey
): string | null {
  const col = DeviceCol[field];
  const { value } = useWatchField<string>(
    DEVICE_ROW_BY_ID_SQL,
    [deviceId],
    col
  );
  return value;
}
