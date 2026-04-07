import { useRouter } from 'expo-router';
import { ExplorerList } from '@gamezilla/shared/ui/explorer';

export default function UIExplorerIndex() {
  const router = useRouter();

  return (
    <ExplorerList
      onSelect={(name) =>
        router.push({ pathname: '/(tabs)/ui/[component]', params: { component: name } })
      }
    />
  );
}
