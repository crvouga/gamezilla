import { PatchDbClientNavigator } from '@gamezilla/patch-db-app/db-client';
import { Box } from '@gamezilla/shared/ui';
import { type Href, useRouter } from 'expo-router';

export default function PatchDbClientScreen() {
  const router = useRouter();

  return (
    <Box sx={{ flex: 1 }}>
      <PatchDbClientNavigator
        onExit={() => router.replace('/more/developer' as Href)}
      />
    </Box>
  );
}
