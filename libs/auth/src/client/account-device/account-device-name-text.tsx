import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { DeviceField, useDeviceColumn } from '../use-device-column';
import { EM_DASH } from '../device-parsers';

export type AccountDeviceNameTextProps = {
  deviceId: string;
};

/** Device display name. */
export function AccountDeviceNameText({
  deviceId,
}: AccountDeviceNameTextProps): ReactNode {
  const name = useDeviceColumn(deviceId, DeviceField.deviceName);
  return <Text variant="body" numberOfLines={4} label={name ?? EM_DASH} />;
}
