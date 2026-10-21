import { useLingui } from '@lingui/solid/macro';
import { P } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatTimestamp } from './device-parsers';
import { useDeviceActiveSessionCount } from './use-device-active-session-count';
import { useDeviceLatestSessionExpiresAt } from './use-device-latest-session-expires-at';

export type AccountDeviceSessionCaptionTextProps = {
  deviceId: string;
};

/** Session count + latest expiry caption for a device row. */
export function AccountDeviceSessionCaptionText(
  props: AccountDeviceSessionCaptionTextProps
): JSX.Element {
  const { t } = useLingui();
  const active = useDeviceActiveSessionCount(() => props.deviceId);
  const latest = useDeviceLatestSessionExpiresAt(() => props.deviceId);
  const label = createMemo(() => {
    const latestExpires = formatTimestamp(latest());
    return active() === 0
      ? t`No active session`
      : t`${active()} active, expires ${latestExpires}`;
  });
  return <P variant="inherit">{label()}</P>;
}
