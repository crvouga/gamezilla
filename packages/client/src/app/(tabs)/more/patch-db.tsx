import { Box } from '@gamezilla/shared/ui';
import { PlaygroundApp } from '@gamezilla/patch-db-app/playground-app';

import { StackScreenHeader } from '@/ui/stack-screen-header';

export default function PatchDbScreen() {
  return (
    <Box sx={{ flex: 1 }}>
      <StackScreenHeader
        title="Patch DB Playground"
        fallbackHref="/(tabs)/more"
      />
      <PlaygroundApp />
    </Box>
  );
}
