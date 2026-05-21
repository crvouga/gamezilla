import { AccountDeviceCurrentBadge } from './account-device-current-badge';
import { AccountDeviceListCaptionText } from './account-device-list-caption-text';
import { AccountDeviceListTitleText } from './account-device-list-title-text';
import { AccountDeviceSessionCaptionText } from './account-device-session-caption-text';
import { Box, IconSymbol, MenuRow } from '@pkgs/ui';
import { useTheme } from '@pkgs/ui/theme';
import type { ReactNode } from 'react';

export type AccountDeviceMenuRowProps = {
  deviceId: string;
  onOpenDevice: (deviceId: string) => void;
};

/** Composed device row: title + captions + current badge + chevron. */
export function AccountDeviceMenuRow({
  deviceId,
  onOpenDevice,
}: AccountDeviceMenuRowProps): ReactNode {
  const theme = useTheme();
  return (
    <MenuRow
      title={<AccountDeviceListTitleText deviceId={deviceId} />}
      caption={
        <Box sx={{ gap: 0.5 }}>
          <AccountDeviceListCaptionText deviceId={deviceId} />
          <AccountDeviceSessionCaptionText deviceId={deviceId} />
        </Box>
      }
      trailing={
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <AccountDeviceCurrentBadge deviceId={deviceId} />
          <IconSymbol
            name="chevron.right"
            size={20}
            color={theme.colors.icon}
          />
        </Box>
      }
      onPress={() => onOpenDevice(deviceId)}
    />
  );
}
