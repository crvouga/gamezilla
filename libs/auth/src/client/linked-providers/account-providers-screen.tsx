import { Box, ScreenBase } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Trans } from '@lingui/react/macro';
import { LinkedProvidersCard } from './linked-providers-card';

export function AccountProvidersScreen() {
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="account-providers"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>Account</Trans>,
          onPress: nav('/more/account'),
        },
        { name: <Trans>Sign-in providers</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
          <LinkedProvidersCard />
        </Box>
      )}
    />
  );
}
