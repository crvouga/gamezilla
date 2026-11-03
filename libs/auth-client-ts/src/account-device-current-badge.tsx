import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

export type AccountDeviceCurrentBadgeProps = {
  /** The device is the install the person is using. */
  readonly current: boolean;
};

/** "This device" badge — renders only for the current install. */
export function AccountDeviceCurrentBadge(
  props: AccountDeviceCurrentBadgeProps
): JSX.Element {
  return (
    <Show when={props.current}>
      <Badge
        label={<Trans>This device</Trans>}
        intent="info"
        size="sm"
        dataSet={{ testid: Handles.accountDeviceCurrent }}
      />
    </Show>
  );
}
