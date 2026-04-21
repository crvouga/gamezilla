import { Box, ScreenBaseHeader } from '@gamezilla/shared/ui';
import { PlaygroundPage } from '@gamezilla/peer-store-app/pages/playground-page';

import { useBreadcrumbNav } from '@/ui/use-breadcrumb-nav';

export default function PeerStoreScreen() {
  const nav = useBreadcrumbNav();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={[
          { name: 'Spaces', onPress: nav('/') },
          { name: 'Settings', onPress: nav('/more') },
          { name: 'Developer', onPress: nav('/more/developer') },
          { name: 'Peer Store Playground' },
        ]}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <PlaygroundPage />
      </Box>
    </Box>
  );
}
