import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, ScreenBase } from '@gamezilla/lib/ui';
import { ExplorerDetail } from '@gamezilla/lib/ui/explorer';
import { useLocalSearchParams } from 'expo-router';

export function UiExplorerDetailScreen() {
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
