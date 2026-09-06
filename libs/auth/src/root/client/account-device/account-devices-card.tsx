import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  CopyToClipboardField,
  EmptyState,
  MenuSection,
  SmartphoneIcon,
} from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useIsSignedIn } from '../../../public/use-current-user';
import { useAccountDeviceIds } from '../use-account-device-ids';
import { AccountDeviceMenuRow } from './account-device-menu-row';

export type AccountDevicesCardProps = {
  accountId: string | null;
  onOpenDevice: (deviceId: string) => void;
};

/** Devices list body for the account devices screen. */
export function AccountDevicesCard({
  accountId,
  onOpenDevice,
}: AccountDevicesCardProps): ReactNode {
  const { t } = useLingui();
  const signedIn = useIsSignedIn();
  const deviceIds = useAccountDeviceIds(signedIn ? accountId : null);

  if (!signedIn || accountId === null) {
    return (
      <EmptyState
        icon={SmartphoneIcon}
        title={<Trans>Sign in to see your devices</Trans>}
        body={
          <Trans>Every install signed into your account shows up here.</Trans>
        }
      />
    );
  }

  if (deviceIds.length === 0) {
    return (
      <EmptyState
        icon={SmartphoneIcon}
        title={<Trans>No devices yet</Trans>}
        body={<Trans>Devices appear here after they sign in.</Trans>}
      />
    );
  }

  return (
    <Box sx={{ gap: 5 }}>
      <MenuSection
        title={<Trans>Devices</Trans>}
        footer={<Trans>Tap a device for details.</Trans>}
      >
        {deviceIds.map((deviceId) => (
          <AccountDeviceMenuRow
            key={deviceId}
            deviceId={deviceId}
            onOpenDevice={onOpenDevice}
          />
        ))}
      </MenuSection>
      <CopyToClipboardField
        label={<Trans>Account ID</Trans>}
        helperText={t`Tap to copy`}
        value={accountId}
      />
    </Box>
  );
}
