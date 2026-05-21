import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Box, ScreenBaseHeader } from '@pkgs/ui';
import { PlaygroundApp } from '@pkgs/patch-db-example/playground-app';
import { Trans } from '@lingui/react/macro';

export function PatchDbScreen() {
  const nav = useBreadcrumbNav();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={[
          { name: <Trans>Spaces</Trans>, onPress: nav('/') },
          { name: <Trans>Settings</Trans>, onPress: nav('/more') },
          { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
          {
            name: <Trans>Patch DB Playground</Trans>,
            subtitle: <Trans>Sync simulation with server and clients</Trans>,
          },
        ]}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <PlaygroundApp />
      </Box>
    </Box>
  );
}
