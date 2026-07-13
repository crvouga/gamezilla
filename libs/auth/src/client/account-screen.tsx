import { Box, MenuList, MenuRow, ScreenBase } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Href, useRouter } from 'expo-router';
import { AccountActionsRow } from './account-actions-row';

export function AccountScreen() {
  const { t } = useLingui();
  const nav = useBreadcrumbNav();
  const router = useRouter();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Account</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
          <MenuList>
            <MenuRow
              title={t`Devices`}
              caption={t`Installs signed into this account`}
              onPress={() => router.push('/more/account/devices' as Href)}
            />
            <MenuRow
              title={t`Sign-in providers`}
              caption={t`How you sign in`}
              onPress={() => router.push('/more/account/providers' as Href)}
            />
          </MenuList>
          <AccountActionsRow />
        </Box>
      )}
    />
  );
}
