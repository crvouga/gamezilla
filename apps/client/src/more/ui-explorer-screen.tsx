import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Box, ScreenBase } from '@gamezilla/lib/ui';
import { ExplorerList } from '@gamezilla/lib/ui/explorer';
import { useRouter } from 'expo-router';

export function UiExplorerScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        { name: 'Developer', onPress: nav('/more/developer') },
        { name: 'UI Components' },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <ExplorerList
            onSelect={(name) =>
              router.push(`/ui/${encodeURIComponent(name)}`)
            }
          />
        </Box>
      )}
    />
  );
}
