import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { formatTimestamp } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceLastSeenTextProps = {
  deviceId: string;
};

/** Last-seen timestamp. */
export function AccountDeviceLastSeenText({
  deviceId,
}: AccountDeviceLastSeenTextProps): ReactNode {
  const lastSeenAt = useDeviceColumn(deviceId, 'lastSeenAt');
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatTimestamp(lastSeenAt)}
    />
  );
}
