import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { AccountDeviceCurrentBadge } from './account-device-current-badge';
import { AccountDeviceListTitleText } from './account-device-list-title-text';
import type { AccountDeviceView } from './account-device-view';

export type AccountDeviceDetailHeaderProps = {
  readonly device: AccountDeviceView;
};

/** Heading row for the device detail page: title + current badge. */
export function AccountDeviceDetailHeader(
  props: AccountDeviceDetailHeaderProps
): JSX.Element {
  return (
    <StackHorizontal wrap align="center" gap="sm">
      <H2 size="heading" lines={2}>
        <AccountDeviceListTitleText device={props.device} />
      </H2>
      <AccountDeviceCurrentBadge current={props.device.current} />
    </StackHorizontal>
  );
}
