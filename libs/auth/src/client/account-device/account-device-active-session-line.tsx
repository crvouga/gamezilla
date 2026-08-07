import { useLingui } from '@lingui/react/macro';
import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { formatTimestamp } from '../device-parsers';
import { useDeviceActiveSessionCount } from '../use-device-active-session-count';
import { useDeviceLatestSessionExpiresAt } from '../use-device-latest-session-expires-at';

export type AccountDeviceActiveSessionLineProps = {
  deviceId: string;
};

/** Active session count + latest expiry caption for the detail page. */
export function AccountDeviceActiveSessionLine({
  deviceId,
}: AccountDeviceActiveSessionLineProps): ReactNode {
  const { t } = useLingui();
  const active = useDeviceActiveSessionCount(deviceId);
  const latest = useDeviceLatestSessionExpiresAt(deviceId);
  const latestExpires = formatTimestamp(latest);
  const label =
    active === 0
      ? t`No active session`
      : t`${active} active session(s) — latest expires ${latestExpires}`;
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}
