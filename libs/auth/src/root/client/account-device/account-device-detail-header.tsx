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
    <div class="box flex-row flex-wrap items-center gap-2">
      <AccountDeviceListTitleText
        deviceId={props.deviceId}
        variant="heading"
        numberOfLines={2}
      />
      <AccountDeviceCurrentBadge deviceId={props.deviceId} />
    </div>
  );
}
