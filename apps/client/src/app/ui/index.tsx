import { Box, ScreenBase } from '@gamezilla/shared/ui';
import { ExplorerList } from '@gamezilla/shared/ui/explorer';
import { useRouter } from 'expo-router';

import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';

export default function UIExplorerIndex() {
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
              router.push({
                pathname: '/ui/[component]',
                params: { component: name },
              })
            }
          />
        </Box>
      )}
    />
  );
}
