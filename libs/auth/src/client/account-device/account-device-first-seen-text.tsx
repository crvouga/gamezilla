import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { formatTimestamp } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceFirstSeenTextProps = {
  deviceId: string;
};

/** First-seen timestamp. */
export function AccountDeviceFirstSeenText({
  deviceId,
}: AccountDeviceFirstSeenTextProps): ReactNode {
  const firstSeenAt = useDeviceColumn(deviceId, 'firstSeenAt');
  return (
    <Text
      variant="body"
      numberOfLines={4}
      label={formatTimestamp(firstSeenAt)}
    />
  );
}
