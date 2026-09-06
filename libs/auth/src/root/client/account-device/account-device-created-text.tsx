import { Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { formatTimestamp } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

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
