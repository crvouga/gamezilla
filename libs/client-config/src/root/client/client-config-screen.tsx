import { Trans } from '@lingui/solid/macro';
import { Box, ScreenBase, useBreadcrumbNav } from '@pkgs/ui';

import { ClientConfigEntityCard } from './client-config-entity-card';

export function ClientConfigScreen() {
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="client-config"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onClick: nav('/') },
        { name: <Trans>Settings</Trans>, onClick: nav('/more') },
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
