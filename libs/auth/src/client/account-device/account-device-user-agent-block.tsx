import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceUserAgentBlockProps = {
  deviceId: string;
};

/** Web user-agent string when present. */
export function AccountDeviceUserAgentBlock({
  deviceId,
}: AccountDeviceUserAgentBlockProps): ReactNode {
  const userAgent = useDeviceColumn(deviceId, 'userAgent');
  if (userAgent === null) return null;
  return (
    <Text variant="caption" selectable numberOfLines={6} label={userAgent} />
  );
}
