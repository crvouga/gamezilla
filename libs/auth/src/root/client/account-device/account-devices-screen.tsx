import { Trans } from '@lingui/react/macro';
import { Box, type Href, ScreenBase, useRouter } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { useCallback } from 'react';
import { useMyAccountId } from '../../../public/use-current-user';
import { AccountDevicesCard } from './account-devices-card';

export function AccountDevicesScreen() {
  const nav = useBreadcrumbNav();
  const router = useRouter();
  const accountId = useMyAccountId();
  const onOpenDevice = useCallback(
    (deviceId: string) => {
      router.push(`/more/account/device/${deviceId}` as Href);
    },
    [router]
  );

  return (
    <ScreenBase
      screenId="account-devices"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>Account</Trans>,
          onPress: nav('/more/account'),
        },
        { name: <Trans>Devices</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 3 }]}>
          <AccountDevicesCard
            accountId={accountId}
            onOpenDevice={onOpenDevice}
          />
        </Box>
      )}
    />
  );
}
