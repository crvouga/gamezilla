import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { ServerWritesPanel } from '@pkgs/patch-db-widgets/server-writes-panel';
import { Box, ScreenBaseHeader } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';

export function PatchDbServerWritesScreen() {
  const nav = useBreadcrumbNav();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={[
          { name: <Trans>Spaces</Trans>, onPress: nav('/') },
          { name: <Trans>Settings</Trans>, onPress: nav('/more') },
          { name: <Trans>Server writes</Trans> },
        ]}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ServerWritesPanel />
      </Box>
    </Box>
  );
}
