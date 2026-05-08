import { useDeviceIsCurrent } from '@gamezilla/client/account/use-device-is-current';
import { Badge } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type AccountDeviceCurrentBadgeProps = {
  deviceId: string;
};

/** "This device" badge — renders only when `deviceId` is the current install. */
export function AccountDeviceCurrentBadge({
  deviceId,
}: AccountDeviceCurrentBadgeProps): ReactNode {
  const isCurrent = useDeviceIsCurrent(deviceId);
  if (!isCurrent) return null;
  return <Badge label={<Trans>This device</Trans>} color="info" size="sm" />;
}
