import { collectDeviceSnapshot } from '@libs/auth/client/collect-device-snapshot';
import { formatDeviceListTitle } from '@libs/auth/client/device-parsers';
import { DeviceCol } from '@libs/db/shared/auth-tables';

/** Snapshot label for the current install (name → model → short id). */
export function resolveCurrentDeviceLabel(deviceId: string): string {
  const snap = collectDeviceSnapshot();
  return formatDeviceListTitle({
    deviceId,
    deviceName: snap[DeviceCol.deviceName] ?? null,
    deviceBrand: snap[DeviceCol.deviceBrand] ?? null,
    deviceModelName: snap[DeviceCol.deviceModelName] ?? null,
  });
}
