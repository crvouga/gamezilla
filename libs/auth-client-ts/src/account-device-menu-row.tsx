import { Handles } from '@libs/test-ids-shared-ts/handles';
import {
  ChevronRightIcon,
  SmartphoneIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { AccountDeviceCurrentBadge } from './account-device-current-badge';
import { AccountDeviceListCaptionText } from './account-device-list-caption-text';
import { AccountDeviceListTitleText } from './account-device-list-title-text';
import { AccountDeviceSessionCaptionText } from './account-device-session-caption-text';

export type AccountDeviceMenuRowProps = {
  deviceId: string;
  onOpenDevice: (deviceId: string) => void;
};

/** Composed device row: title + captions + current badge + chevron. */
const ROW_ICON_SIZE = 20;

export function AccountDeviceMenuRow(
  props: AccountDeviceMenuRowProps
): JSX.Element {
  return (
    <MenuRow
      title={<AccountDeviceListTitleText deviceId={props.deviceId} lines={1} />}
      caption={
        <StackVertical>
          <AccountDeviceListCaptionText deviceId={props.deviceId} lines={1} />
          <AccountDeviceSessionCaptionText deviceId={props.deviceId} />
        </StackVertical>
      }
      leading={<SmartphoneIcon size={ROW_ICON_SIZE} color="icon" />}
      trailing={
        <StackHorizontal align="center" gap="sm">
          <AccountDeviceCurrentBadge deviceId={props.deviceId} />
          <ChevronRightIcon size={ROW_ICON_SIZE} color="icon" />
        </StackHorizontal>
      }
      onClick={() => props.onOpenDevice(props.deviceId)}
      dataSet={{ testid: Handles.accountDevice(props.deviceId) }}
    />
  );
}
