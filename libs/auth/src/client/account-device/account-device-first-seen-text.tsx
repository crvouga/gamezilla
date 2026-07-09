import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { DeviceField, useDeviceColumn } from '../use-device-column';
import { formatTimestamp } from '../device-parsers';

export type AccountDeviceFirstSeenTextProps = {
  deviceId: string;
};

/** First-seen timestamp. */
export function AccountDeviceFirstSeenText({
  deviceId,
}: AccountDeviceFirstSeenTextProps): ReactNode {
  const firstSeenAt = useDeviceColumn(deviceId, DeviceField.firstSeenAt);
  return (
    <Text variant="body" numberOfLines={4} label={formatTimestamp(firstSeenAt)} />
  );
}
