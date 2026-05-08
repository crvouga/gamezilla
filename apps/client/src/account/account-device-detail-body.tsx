import { AccountDeviceActiveSessionLine } from '@gamezilla/client/account/account-device-active-session-line';
import { AccountDeviceIdField } from '@gamezilla/client/account/account-device-id-field';
import { AccountDeviceMetaGrid } from '@gamezilla/client/account/account-device-meta-grid';
import { AccountDeviceUserAgentBlock } from '@gamezilla/client/account/account-device-user-agent-block';
import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type AccountDeviceDetailBodyProps = {
  deviceId: string;
};

/** Pure layout for a device detail body — id, meta grid, user-agent, sessions. */
export function AccountDeviceDetailBody({
  deviceId,
}: AccountDeviceDetailBodyProps): ReactNode {
  return (
    <Box sx={{ gap: 4 }}>
      <AccountDeviceIdField deviceId={deviceId} />
      <AccountDeviceMetaGrid deviceId={deviceId} />
      <AccountDeviceUserAgentBlock deviceId={deviceId} />
      <AccountDeviceActiveSessionLine deviceId={deviceId} />
    </Box>
  );
}
