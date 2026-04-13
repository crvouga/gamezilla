import { useRouter } from 'expo-router';
import { useTheme } from '@gamezilla/shared/theme';
import { Box, IconSymbol, Pressable, Text } from '@gamezilla/shared/ui';

import { ScreenHeader } from '@/ui/screen-header';

type DevHref = '/todos' | '/ui' | '/more/patch-db' | '/more/peer-store';

const ITEMS: readonly {
  key: string;
  href: DevHref;
  label: string;
  description: string;
}[] = [
  {
    key: 'todos',
    href: '/todos',
    label: 'Todos',
    description: 'Patch DB todo lists (demo)',
  },
  {
    key: 'ui',
    href: '/ui',
    label: 'UI Components',
    description: 'Shared UI explorer',
  },
  {
    key: 'patch-db',
    href: '/more/patch-db',
    label: 'Patch DB Playground',
    description: 'Sync simulation with server and clients',
  },
  {
    key: 'peer-store',
    href: '/more/peer-store',
    label: 'Peer Store Playground',
    description: 'Multi-peer tic-tac-toe simulator',
  },
] as const;

export default function MoreIndex() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title="Settings"
        subtitle="App and developer tools"
        fallbackHref="/"
      />
      <Box sx={{ flex: 1, py: 2 }}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.href)}
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
                <Text variant="bodyBold" label={item.label} />
                <Text variant="caption" label={item.description} />
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
