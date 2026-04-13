import { useRouter } from 'expo-router';
import { Box } from '@gamezilla/shared/ui';
import { ExplorerList } from '@gamezilla/shared/ui/explorer';

import { ScreenHeader } from '@/ui/screen-header';

export default function UIExplorerIndex() {
  const router = useRouter();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="UI Components" fallbackHref="/more" />
      <ExplorerList
        onSelect={(name) =>
          router.push({
            pathname: '/ui/[component]',
            params: { component: name },
          })
        }
      />
    </Box>
  );
}
