import { useRouter } from 'expo-router';
import { Box, Text } from '@gamezilla/shared/ui';
import { ExplorerList } from '@gamezilla/shared/ui/explorer';

export default function UIExplorerIndex() {
  const router = useRouter();

  return (
    <Box sx={{ flex: 1 }}>
      <Box sx={{ px: 4, pt: 4, pb: 2 }}>
        <Text variant="heading">UI Components</Text>
      </Box>
      <ExplorerList
        onSelect={(name) =>
          router.push({
            pathname: '/(tabs)/ui/[component]',
            params: { component: name },
          })
        }
      />
    </Box>
  );
}
