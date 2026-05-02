import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { PlaygroundApp } from '@gamezilla/patch-db-example/playground-app';
import { Box, ScreenBaseHeader } from '@gamezilla/lib/ui';

export function PatchDbScreen() {
  const nav = useBreadcrumbNav();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={[
          { name: 'Spaces', onPress: nav('/') },
          { name: 'Settings', onPress: nav('/more') },
          { name: 'Developer', onPress: nav('/more/developer') },
          { name: 'Patch DB Playground' },
        ]}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <PlaygroundApp />
      </Box>
    </Box>
  );
}
