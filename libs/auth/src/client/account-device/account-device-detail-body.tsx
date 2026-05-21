import { AccountDeviceActiveSessionLine } from './account-device-active-session-line';
import { AccountDeviceIdField } from './account-device-id-field';
import { AccountDeviceMetaGrid } from './account-device-meta-grid';
import { AccountDeviceUserAgentBlock } from './account-device-user-agent-block';
import { Box } from '@pkgs/ui';
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
