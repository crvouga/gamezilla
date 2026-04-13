import { Box } from '@gamezilla/shared/ui';
import { PlaygroundApp } from '@gamezilla/patch-db-app/playground-app';

import { ScreenHeader } from '@/ui/screen-header';

export default function PatchDbScreen() {
  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="Patch DB Playground" fallbackHref="/more/developer" />
      <PlaygroundApp />
    </Box>
  );
}
