import { Trans } from '@lingui/react/macro';
import { Box, Card, ScreenBase, Text } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { useLocalSearchParams } from 'expo-router';
import { AccountDeviceDetailBody } from './account-device-detail-body';
import { AccountDeviceDetailHeader } from './account-device-detail-header';

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
      screenId="account-device-detail"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>Account</Trans>,
          onPress: nav('/more/account'),
        },
        { name: <Trans>Device</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
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
