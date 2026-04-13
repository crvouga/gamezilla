import { ExplorerDetail } from '@gamezilla/shared/ui/explorer';
import { Box } from '@gamezilla/shared/ui';
import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/ui/screen-header';

export default function UIExplorerDetail() {
  const { component } = useLocalSearchParams<{ component: string }>();
  const name = component ?? '';

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title={name || 'Component'}
        fallbackHref="/(tabs)/ui"
      />
      <ExplorerDetail componentName={name} />
    </Box>
  );
}
