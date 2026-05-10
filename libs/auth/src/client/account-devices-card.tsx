import { AccountDeviceMenuRow } from './account-device-menu-row';
import { useAccountDeviceIds } from './use-account-device-ids';
import { Box, Card, CopyToClipboardField, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

function CaptionLine({ label }: { label: ReactNode }) {
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}

export type AccountDevicesCardProps = {
  accountId: string | null;
  onOpenDevice: (deviceId: string) => void;
};

/** Devices section for the account screen — pure layout + atoms. */
export function AccountDevicesCard({
  accountId,
  onOpenDevice,
}: AccountDevicesCardProps): ReactNode {
  const { t } = useLingui();
  const deviceIds = useAccountDeviceIds(accountId);

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Devices</Trans>} />
      <CaptionLine
        label={
          <Trans>
            Each install has its own device id. Tap a row for full details.
          </Trans>
        }
      />
      {accountId !== null ? (
        <CopyToClipboardField
          label={<Trans>Account ID</Trans>}
          helperText={t`Server-side account; tap to copy`}
          value={accountId}
        />
      ) : (
        <CaptionLine
          label={
            <Trans>
              Sign in to link this device to a server account and see all
              devices for that account.
            </Trans>
          }
        />
      )}
      {deviceIds.length === 0 ? (
        <CaptionLine label={<Trans>No device data yet.</Trans>} />
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
