import { useLingui } from '@lingui/solid/macro';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import type { AccountDeviceView } from './account-device-view';
import { formatTimestamp } from './device-parsers';

export type AccountDeviceSessionCaptionTextProps = {
  readonly device: AccountDeviceView;
};

/** Session count + latest expiry caption for a device row. */
export function AccountDeviceSessionCaptionText(
  props: AccountDeviceSessionCaptionTextProps
): JSX.Element {
  const { t } = useLingui();
  const active = (): number => props.device.activeSessions;
  const label = createMemo(() => {
    const latestExpires = formatTimestamp(props.device.latestSessionExpiresAt);
    return active() === 0
      ? t`No active session`
      : t`${active()} active, expires ${latestExpires}`;
  });
  return <P variant="inherit">{label()}</P>;
}
