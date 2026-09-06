import { Trans } from '@lingui/react/macro';
import {
  Box,
  EmptyState,
  ScreenBase,
  SmartphoneIcon,
  useLocalSearchParams,
} from '@pkgs/ui-rn';
import { useBreadcrumbNav } from '@pkgs/ui-rn/components/use-breadcrumb-nav';
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
        <Box sx={[sx, { gap: 5 }]}>
          {deviceId === null ? (
            <EmptyState
              icon={SmartphoneIcon}
              title={<Trans>Device not found</Trans>}
              body={<Trans>This link is missing a device id.</Trans>}
            />
          ) : (
            <>
              <AccountDeviceDetailHeader deviceId={deviceId} />
              <AccountDeviceDetailBody deviceId={deviceId} />
            </>
          )}
        </Box>
      )}
    />
  );
}
