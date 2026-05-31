import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Box, ScreenBaseHeader } from '@pkgs/ui';
import { PlaygroundPage } from '@pkgs/room-widgets/pages/playground-page';
import { Trans } from '@lingui/react/macro';

export function RoomScreen() {
  const nav = useBreadcrumbNav();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={[
          { name: <Trans>Spaces</Trans>, onPress: nav('/') },
          { name: <Trans>Settings</Trans>, onPress: nav('/more') },
          { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
          { name: <Trans>Room Playground</Trans> },
        ]}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <PlaygroundPage />
      </Box>
    </Box>
  );
}
