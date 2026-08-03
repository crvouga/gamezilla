import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useDeviceColumn } from '../use-device-column';
import { formatTimestamp } from '../device-parsers';

export type AccountDeviceCreatedTextProps = {
  deviceId: string;
};

/** Created-at timestamp. */
export function AccountDeviceCreatedText({
  deviceId,
}: AccountDeviceCreatedTextProps): ReactNode {
  const createdAt = useDeviceColumn(deviceId, 'createdAt');
  return (
    <Text variant="body" numberOfLines={4} label={formatTimestamp(createdAt)} />
  );
}
