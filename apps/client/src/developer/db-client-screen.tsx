import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { ExplorerRoute } from '@gamezilla/patch-db-example/db-client/navigator';
import { Box, ScreenBaseHeader } from '@gamezilla/lib/ui';
import {
  type Href,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';

export function DbClientScreen() {
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
          // ExplorerRoute expects patch-db-example navigator types; screen bridges expo-router.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          navigation={navigation as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          route={{ key: 'db-client', name: 'explorer', params } as any}
          onExit={() => router.replace('/more/developer' as Href)}
        />
      </Box>
    </Box>
  );
}
