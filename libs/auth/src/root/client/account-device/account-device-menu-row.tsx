import { Box, ChevronRightIcon, MenuRow, SmartphoneIcon } from '@pkgs/ui';
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
      title={
        <AccountDeviceListTitleText
          deviceId={props.deviceId}
          numberOfLines={1}
        />
      }
      caption={
        <Box sx={{ gap: 0.5 }}>
          <AccountDeviceListCaptionText
            deviceId={props.deviceId}
            variant="caption"
            numberOfLines={1}
            sx={{ color: 'textSecondary' }}
          />
          <AccountDeviceSessionCaptionText deviceId={props.deviceId} />
        </Box>
      }
      leading={<SmartphoneIcon size={ROW_ICON_SIZE} color="icon" />}
      trailing={
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <AccountDeviceCurrentBadge deviceId={props.deviceId} />
          <ChevronRightIcon size={20} color="icon" />
        </Box>
      }
      onClick={() => props.onOpenDevice(props.deviceId)}
    />
  );
}
