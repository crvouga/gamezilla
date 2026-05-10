import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, ScreenBaseHeader } from '@gamezilla/ui';
import { PlaygroundPage } from '@gamezilla/room-example/pages/playground-page';
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
          {
            name: <Trans>Room Playground</Trans>,
            subtitle: <Trans>Multi-peer tic-tac-toe simulator</Trans>,
          },
        ]}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <PlaygroundPage />
      </Box>
    </Box>
  );
}
