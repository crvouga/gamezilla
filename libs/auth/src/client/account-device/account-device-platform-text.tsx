import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { DeviceField, useDeviceColumn } from '../use-device-column';
import { EM_DASH } from '../device-parsers';

export type AccountDevicePlatformTextProps = {
  deviceId: string;
};

/** `devices.platform` value, with em-dash fallback. */
export function AccountDevicePlatformText({
  deviceId,
}: AccountDevicePlatformTextProps): ReactNode {
  const platform = useDeviceColumn(deviceId, DeviceField.platform);
  return <Text variant="body" numberOfLines={4} label={platform ?? EM_DASH} />;
}
