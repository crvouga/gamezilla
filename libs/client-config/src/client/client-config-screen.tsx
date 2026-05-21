import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Box, ScreenBase } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';

import { ClientConfigEntityCard } from './client-config-entity-card';
import { ClientConfigServerRefreshCard } from './client-config-server-refresh';

export function ClientConfigScreen() {
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
        {
          name: <Trans>Client config</Trans>,
          subtitle: <Trans>Singleton entity + server refresh</Trans>,
        },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          <ClientConfigEntityCard />
          <ClientConfigServerRefreshCard />
        </Box>
      )}
    />
  );
}
