import { useLingui } from '@lingui/react/macro';
import { MenuRow } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { formatTimestamp } from '../device-parsers';
import { useDeviceActiveSessionCount } from '../use-device-active-session-count';
import { useDeviceLatestSessionExpiresAt } from '../use-device-latest-session-expires-at';

export type AccountDeviceActiveSessionLineProps = {
  deviceId: string;
};

/** Active session count + latest expiry row for the detail page. */
export function AccountDeviceActiveSessionLine({
  deviceId,
}: AccountDeviceActiveSessionLineProps): ReactNode {
  const { t } = useLingui();
  const active = useDeviceActiveSessionCount(deviceId);
  const latest = useDeviceLatestSessionExpiresAt(deviceId);
  const latestExpires = formatTimestamp(latest);
  return (
    <MenuRow
      title={t`Active sessions`}
      value={String(active)}
      {...(active > 0 ? { caption: t`Latest expires ${latestExpires}` } : {})}
    />
  );
}
