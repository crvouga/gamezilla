import { AccountDeviceCurrentBadge } from './account-device-current-badge';
import { AccountDeviceListTitleText } from './account-device-list-title-text';
import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type AccountDeviceDetailHeaderProps = {
  deviceId: string;
};

/** Heading row for the device detail page: title + current badge. */
export function AccountDeviceDetailHeader({
  deviceId,
}: AccountDeviceDetailHeaderProps): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <AccountDeviceListTitleText
        deviceId={deviceId}
        variant="heading"
        numberOfLines={2}
      />
      <AccountDeviceCurrentBadge deviceId={deviceId} />
    </Box>
  );
}
