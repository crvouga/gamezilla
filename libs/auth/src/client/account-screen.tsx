import { Box, ScreenBase } from '@gamezilla/ui';
import { useBreadcrumbNav } from '@gamezilla/ui/components/use-breadcrumb-nav';
import { Trans } from '@lingui/react/macro';
import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { AccountActionsRow } from './account-actions-row';
import { AccountDevicesCard } from './account-device/account-devices-card';
import { useMyAccountId } from './use-current-user';
import { LinkedProvidersCard } from './linked-providers/linked-providers-card';

export function AccountScreen() {
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
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>Account</Trans>,
          subtitle: <Trans>Devices and sign-in provider records</Trans>,
        },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          <AccountDevicesCard
            accountId={accountId}
            onOpenDevice={onOpenDevice}
          />
          <LinkedProvidersCard accountId={accountId} />
          <AccountActionsRow />
        </Box>
      )}
    />
  );
}
