import { Trans } from '@lingui/react/macro';
import { Box, ScreenBase } from '@pkgs/ui-rn';
import { useBreadcrumbNav } from '@pkgs/ui-rn/components/use-breadcrumb-nav';

import { ClientConfigEntityCard } from './client-config-entity-card';

export function ClientConfigScreen() {
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="client-config"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Client config</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          <ClientConfigEntityCard />
        </Box>
      )}
    />
  );
}
