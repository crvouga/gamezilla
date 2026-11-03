import { useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import type { AccountDeviceView } from './account-device-view';
import { formatTimestamp } from './device-parsers';

export type AccountDeviceActiveSessionLineProps = {
  readonly device: AccountDeviceView;
};

/** Active session count + latest expiry row for the detail page. */
export function AccountDeviceActiveSessionLine(
  props: AccountDeviceActiveSessionLineProps
): JSX.Element {
  const { t } = useLingui();
  const latestExpires = createMemo(() =>
    formatTimestamp(props.device.latestSessionExpiresAt)
  );
  const value = createMemo(() => String(props.device.activeSessions));
  const caption = createMemo(() =>
    props.device.activeSessions > 0
      ? t`Latest expires ${latestExpires()}`
      : undefined
  );
  return (
    <MenuRow title={t`Active sessions`} value={value()} caption={caption()} />
  );
}
