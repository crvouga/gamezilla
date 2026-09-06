import { Trans } from '@lingui/react/macro';
import { Box, MenuSection } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { AccountDeviceActiveSessionLine } from './account-device-active-session-line';
import { AccountDeviceIdField } from './account-device-id-field';
import { AccountDeviceMetaGrid } from './account-device-meta-grid';
import { AccountDeviceUserAgentBlock } from './account-device-user-agent-block';

export type AccountDeviceDetailBodyProps = {
  deviceId: string;
};

/** Pure layout for a device detail body — meta rows, sessions, id, UA. */
export function AccountDeviceDetailBody({
  deviceId,
}: AccountDeviceDetailBodyProps): ReactNode {
  return (
    <>
      <AccountDeviceMetaGrid deviceId={deviceId} />
      <MenuSection
        title={<Trans>Sessions</Trans>}
        footer={<AccountDeviceUserAgentBlock deviceId={deviceId} />}
      >
        <AccountDeviceActiveSessionLine deviceId={deviceId} />
      </MenuSection>
      <Box>
        <AccountDeviceIdField deviceId={deviceId} />
      </Box>
    </>
  );
}
