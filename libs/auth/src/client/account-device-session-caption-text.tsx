import { formatTimestamp } from './device-parsers';
import { useDeviceActiveSessionCount } from './use-device-active-session-count';
import { useDeviceLatestSessionExpiresAt } from './use-device-latest-session-expires-at';
import { Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type AccountDeviceSessionCaptionTextProps = {
  deviceId: string;
};

/** Session count + latest expiry caption for a device row. */
export function AccountDeviceSessionCaptionText({
  deviceId,
}: AccountDeviceSessionCaptionTextProps): ReactNode {
  const { t } = useLingui();
  const active = useDeviceActiveSessionCount(deviceId);
  const latest = useDeviceLatestSessionExpiresAt(deviceId);
  const latestExpires = formatTimestamp(latest);
  const label =
    active === 0
      ? t`No active session`
      : t`${active} active — expires ${latestExpires}`;
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}
