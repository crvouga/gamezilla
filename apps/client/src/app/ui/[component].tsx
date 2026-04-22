import { ExplorerDetail } from '@gamezilla/shared/ui/explorer';
import { Box, ScreenBase } from '@gamezilla/shared/ui';
import { useLocalSearchParams } from 'expo-router';

import { useBreadcrumbNav } from '@/ui/use-breadcrumb-nav';

export default function UIExplorerDetail() {
  const { component } = useLocalSearchParams<{ component: string }>();
  const name = component ?? '';
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        { name: 'Developer', onPress: nav('/more/developer') },
        { name: 'UI Components', onPress: nav('/ui') },
        { name: name || 'Component' },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <ExplorerDetail componentName={name} />
        </Box>
      )}
    />
  );
}
