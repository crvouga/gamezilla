import { Trans, useLingui } from '@lingui/react/macro';
import { Box, Card, CopyToClipboardField, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useAccountDeviceIds } from '../use-account-device-ids';
import { useIsSignedIn } from '../use-current-user';
import { AccountDeviceMenuRow } from './account-device-menu-row';

function CaptionLine({ label }: { label: ReactNode }) {
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}

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

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Devices</Trans>} />
      <CaptionLine label={<Trans>Tap a device for details.</Trans>} />
      {signedIn && accountId !== null ? (
        <CopyToClipboardField
          label={<Trans>Account ID</Trans>}
          helperText={t`Tap to copy`}
          value={accountId}
        />
      ) : (
        <CaptionLine
          label={<Trans>Sign in to see devices linked to your account.</Trans>}
        />
      )}
      {deviceIds.length === 0 ? (
        <CaptionLine label={<Trans>No devices yet.</Trans>} />
      ) : (
        <Box sx={{ gap: 0, pt: 2 }}>
          {deviceIds.map((deviceId) => (
            <AccountDeviceMenuRow
              key={deviceId}
              deviceId={deviceId}
              onOpenDevice={onOpenDevice}
            />
          ))}
        </Box>
      )}
    </Card>
  );
}
