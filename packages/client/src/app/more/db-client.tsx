import { ExplorerRoute } from '@gamezilla/patch-db-app/db-client/navigator';
import {
  type Href,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';

export default function PatchDbClientRoute() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  return (
    <ExplorerRoute
      navigation={navigation as any}
      route={{ key: 'db-client', name: 'explorer', params } as any}
      onExit={() => router.replace('/more/developer' as Href)}
    />
  );
}
