import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { DeviceField, useDeviceColumn } from '../use-device-column';
import { formatTimestamp } from '../device-parsers';

export type AccountDeviceLastSeenTextProps = {
  deviceId: string;
};

/** Last-seen timestamp. */
export function AccountDeviceLastSeenText({
  deviceId,
}: AccountDeviceLastSeenTextProps): ReactNode {
  const lastSeenAt = useDeviceColumn(deviceId, DeviceField.lastSeenAt);
  return (
    <Text variant="body" numberOfLines={4} label={formatTimestamp(lastSeenAt)} />
  );
}
