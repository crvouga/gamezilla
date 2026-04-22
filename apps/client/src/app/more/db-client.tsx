import { ExplorerRoute } from '@gamezilla/patch-db-example/db-client/navigator';
import { Box, ScreenBaseHeader } from '@gamezilla/shared/ui';
import {
  type Href,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';

import { useBreadcrumbNav } from '@/ui/use-breadcrumb-nav';

export default function PatchDbClientRoute() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const nav = useBreadcrumbNav();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={[
          { name: 'Spaces', onPress: nav('/') },
          { name: 'Settings', onPress: nav('/more') },
          { name: 'Developer', onPress: nav('/more/developer') },
          { name: 'Patch DB Client' },
        ]}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ExplorerRoute
          navigation={navigation as any}
          route={{ key: 'db-client', name: 'explorer', params } as any}
          onExit={() => router.replace('/more/developer' as Href)}
        />
      </Box>
    </Box>
  );
}
