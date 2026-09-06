import { Box, ChevronRightIcon, MenuRow, SmartphoneIcon } from '@pkgs/ui';
import { useTheme } from '@pkgs/ui/theme';
import type { ReactNode } from 'react';
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

export function AccountDeviceMenuRow({
  deviceId,
  onOpenDevice,
}: AccountDeviceMenuRowProps): ReactNode {
  const theme = useTheme();
  return (
    <MenuRow
      title={
        <AccountDeviceListTitleText deviceId={deviceId} numberOfLines={1} />
      }
      caption={
        <Box sx={{ gap: 0.5 }}>
          <AccountDeviceListCaptionText
            deviceId={deviceId}
            variant="caption"
            numberOfLines={1}
            sx={{ color: 'textSecondary' }}
          />
          <AccountDeviceSessionCaptionText deviceId={deviceId} />
        </Box>
      }
      leading={
        <SmartphoneIcon size={ROW_ICON_SIZE} color={theme.colors.icon} />
      }
      trailing={
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <AccountDeviceCurrentBadge deviceId={deviceId} />
          <ChevronRightIcon size={20} color={theme.colors.icon} />
        </Box>
      }
      onPress={() => onOpenDevice(deviceId)}
    />
  );
}
