import { AccountDeviceAppText } from '@gamezilla/client/account/account-device-app-text';
import { AccountDeviceCreatedText } from '@gamezilla/client/account/account-device-created-text';
import { AccountDeviceFirstSeenText } from '@gamezilla/client/account/account-device-first-seen-text';
import { AccountDeviceLastSeenText } from '@gamezilla/client/account/account-device-last-seen-text';
import { AccountDeviceMetaPair } from '@gamezilla/client/account/account-device-meta-pair';
import { AccountDeviceModelText } from '@gamezilla/client/account/account-device-model-text';
import { AccountDeviceNameText } from '@gamezilla/client/account/account-device-name-text';
import { AccountDeviceOsText } from '@gamezilla/client/account/account-device-os-text';
import { AccountDevicePlatformText } from '@gamezilla/client/account/account-device-platform-text';
import { Box } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type AccountDeviceMetaGridProps = {
  deviceId: string;
};

/** Grid of label / atom rows for a device's meta attributes. */
export function AccountDeviceMetaGrid({
  deviceId,
}: AccountDeviceMetaGridProps): ReactNode {
  return (
    <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      <AccountDeviceMetaPair
        label={<Trans>Platform</Trans>}
        valueAtom={<AccountDevicePlatformText deviceId={deviceId} />}
      />
      <AccountDeviceMetaPair
        label={<Trans>OS</Trans>}
        valueAtom={<AccountDeviceOsText deviceId={deviceId} />}
      />
      <AccountDeviceMetaPair
        label={<Trans>Device name</Trans>}
        valueAtom={<AccountDeviceNameText deviceId={deviceId} />}
      />
      <AccountDeviceMetaPair
        label={<Trans>Model</Trans>}
        valueAtom={<AccountDeviceModelText deviceId={deviceId} />}
      />
      <AccountDeviceMetaPair
        label={<Trans>App</Trans>}
        valueAtom={<AccountDeviceAppText deviceId={deviceId} />}
      />
      <AccountDeviceMetaPair
        label={<Trans>First seen</Trans>}
        valueAtom={<AccountDeviceFirstSeenText deviceId={deviceId} />}
      />
      <AccountDeviceMetaPair
        label={<Trans>Last seen</Trans>}
        valueAtom={<AccountDeviceLastSeenText deviceId={deviceId} />}
      />
      <AccountDeviceMetaPair
        label={<Trans>Created</Trans>}
        valueAtom={<AccountDeviceCreatedText deviceId={deviceId} />}
      />
    </Box>
  );
}
