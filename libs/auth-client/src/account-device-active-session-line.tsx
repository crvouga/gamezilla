import { useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatTimestamp } from './device-parsers';
import { useDeviceActiveSessionCount } from './use-device-active-session-count';
import { useDeviceLatestSessionExpiresAt } from './use-device-latest-session-expires-at';

export type AccountDeviceActiveSessionLineProps = {
  deviceId: string;
};

/** Active session count + latest expiry row for the detail page. */
export function AccountDeviceActiveSessionLine(
  props: AccountDeviceActiveSessionLineProps
): JSX.Element {
  const { t } = useLingui();
  const active = useDeviceActiveSessionCount(() => props.deviceId);
  const latest = useDeviceLatestSessionExpiresAt(() => props.deviceId);
  const latestExpires = createMemo(() => formatTimestamp(latest()));
  const value = createMemo(() => String(active()));
  const caption = createMemo(() =>
    active() > 0 ? t`Latest expires ${latestExpires()}` : undefined
  );
  return (
    <MenuRow title={t`Active sessions`} value={value()} caption={caption()} />
  );
}
