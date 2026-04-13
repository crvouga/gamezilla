import { useRouter } from 'expo-router';
import { useTheme } from '@gamezilla/shared/theme';
import { Box, IconSymbol, Pressable, Text } from '@gamezilla/shared/ui';

import { ScreenHeader } from '@/ui/screen-header';

const ITEMS = [
  {
    key: 'patch-db' as const,
    label: 'Patch DB Playground',
    description: 'Sync simulation with server and clients',
  },
  {
    key: 'peer-store' as const,
    label: 'Peer Store Playground',
    description: 'Multi-peer tic-tac-toe simulator',
  },
] as const;

export default function MoreIndex() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="More" />
      <Box sx={{ flex: 1, py: 2 }}>
      {ITEMS.map((item) => (
        <Pressable
          key={item.key}
          onPress={() =>
            router.push({ pathname: `/(tabs)/more/${item.key}` as const })
          }
        >
          <Box
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              px: 4,
              py: 3,
              gap: 3,
            }}
          >
            <Box sx={{ flex: 1, gap: 1 }}>
              <Text variant="bodyBold">{item.label}</Text>
              <Text variant="caption">{item.description}</Text>
            </Box>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={theme.colors.icon}
            />
          </Box>
        </Pressable>
      ))}
      </Box>
    </Box>
  );
}
