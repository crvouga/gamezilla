import { Badge } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useDeviceIsCurrent } from '../use-device-is-current';

export type AccountDeviceCurrentBadgeProps = {
  deviceId: string;
};

/** "This device" badge — renders only when `deviceId` is the current install. */
export function AccountDeviceCurrentBadge({
  deviceId,
}: AccountDeviceCurrentBadgeProps): ReactNode {
  const isCurrent = useDeviceIsCurrent(deviceId);
  if (!isCurrent) return null;
  return <Badge label={<Trans>This device</Trans>} intent="info" size="sm" />;
}
