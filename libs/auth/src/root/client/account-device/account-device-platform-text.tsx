import { Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { EM_DASH } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

export type AccountDevicePlatformTextProps = {
  deviceId: string;
};

/** `devices.platform` value, with em-dash fallback. */
export function AccountDevicePlatformText({
  deviceId,
}: AccountDevicePlatformTextProps): ReactNode {
  const platform = useDeviceColumn(deviceId, 'platform');
  return <Text variant="body" numberOfLines={4} label={platform ?? EM_DASH} />;
}
