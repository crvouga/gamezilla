import { H2 } from '@pkgs/ui-root-client/heading';
import { StackHorizontal } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';
import { AccountDeviceCurrentBadge } from './account-device-current-badge';
import { AccountDeviceListTitleText } from './account-device-list-title-text';

export type AccountDeviceDetailHeaderProps = {
  deviceId: string;
};

/** Heading row for the device detail page: title + current badge. */
export function AccountDeviceDetailHeader(
  props: AccountDeviceDetailHeaderProps
): JSX.Element {
  return (
    <StackHorizontal wrap align="center" gap="sm">
      <H2 size="heading" lines={2}>
        <AccountDeviceListTitleText deviceId={props.deviceId} />
      </H2>
      <AccountDeviceCurrentBadge deviceId={props.deviceId} />
    </StackHorizontal>
  );
}
