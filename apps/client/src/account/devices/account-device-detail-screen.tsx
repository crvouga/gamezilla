import { AccountDeviceDetailBody } from '@gamezilla/client/account/devices/account-device-detail-body';
import { AccountDeviceDetailHeader } from '@gamezilla/client/account/devices/account-device-detail-header';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, Card, ScreenBase, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import { type Href, useLocalSearchParams } from 'expo-router';

function normalizeDeviceId(raw: string | string[] | undefined): string | null {
  if (raw === undefined) return null;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== 'string' || s.trim().length === 0) return null;
  return s.trim();
}

export function AccountDeviceDetailScreen() {
  const nav = useBreadcrumbNav();
  const params = useLocalSearchParams<{ deviceId?: string | string[] }>();
  const deviceId = normalizeDeviceId(params.deviceId);

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>Account</Trans>,
          onPress: nav('/more/account' as Href),
        },
        { name: <Trans>Device</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          {deviceId === null ? (
            <Text variant="body" label={<Trans>Missing device id.</Trans>} />
          ) : (
            <Card elevation={1} sx={{ p: 4, gap: 3 }}>
              <AccountDeviceDetailHeader deviceId={deviceId} />
              <AccountDeviceDetailBody deviceId={deviceId} />
            </Card>
          )}
        </Box>
      )}
    />
  );
}
