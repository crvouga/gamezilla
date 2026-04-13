import { Box } from '@gamezilla/shared/ui';
import { PlaygroundPage } from '@gamezilla/peer-store-app/pages/playground-page';

import { StackScreenHeader } from '@/ui/stack-screen-header';

export default function PeerStoreScreen() {
  return (
    <Box sx={{ flex: 1 }}>
      <StackScreenHeader
        title="Peer Store Playground"
        fallbackHref="/(tabs)/more"
      />
      <PlaygroundPage />
    </Box>
  );
}
