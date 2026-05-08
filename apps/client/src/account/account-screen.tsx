import { AccountActionsRow } from '@gamezilla/client/account/account-actions-row';
import { AccountDevicesCard } from '@gamezilla/client/account/devices/account-devices-card';
import { LinkedProvidersCard } from '@gamezilla/client/account/linked-providers/linked-providers-card';
import { useAuth } from '@gamezilla/client/auth/auth-context';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, ScreenBase } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';

export function AccountScreen() {
  const nav = useBreadcrumbNav();
  const router = useRouter();
  const auth = useAuth();
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
            accountId={auth.accountId}
            onOpenDevice={onOpenDevice}
          />
          <LinkedProvidersCard accountId={auth.accountId} />
          <AccountActionsRow />
        </Box>
      )}
    />
  );
}
