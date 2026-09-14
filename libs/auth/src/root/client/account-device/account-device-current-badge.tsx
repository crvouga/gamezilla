import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { useDeviceIsCurrent } from '../use-device-is-current';

export type AccountDeviceCurrentBadgeProps = {
  deviceId: string;
};

/** "This device" badge — renders only when `deviceId` is the current install. */
export function AccountDeviceCurrentBadge(
  props: AccountDeviceCurrentBadgeProps
): JSX.Element {
  const isCurrent = useDeviceIsCurrent(() => props.deviceId);
  return (
    <Show when={isCurrent()}>
      <Badge label={<Trans>This device</Trans>} intent="info" size="sm" />
    </Show>
  );
}
