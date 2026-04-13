import { Box } from '@gamezilla/shared/ui';
import { PlaygroundPage } from '@gamezilla/peer-store-app/pages/playground-page';

import { ScreenHeader } from '@/ui/screen-header';

export default function PeerStoreScreen() {
  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title="Peer Store Playground"
        fallbackHref="/(tabs)/more"
      />
      <PlaygroundPage />
    </Box>
  );
}
