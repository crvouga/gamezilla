import {
  Box,
  IconSymbol,
  Pressable,
  Text,
  useTheme,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/ui/screen-header';

export default function MoreIndex() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title="Settings"
        subtitle="App preferences and tools"
        fallbackHref="/"
      />
      <Box sx={{ flex: 1, py: 2 }}>
        <Pressable onPress={() => router.push('/more/theme')}>
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
              <Text variant="bodyBold" label="Appearance" />
              <Text variant="caption" label="Light, dark, or system theme" />
            </Box>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={theme.colors.icon}
            />
          </Box>
        </Pressable>
        <Pressable onPress={() => router.push('/more/developer')}>
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
              <Text variant="bodyBold" label="Developer" />
              <Text
                variant="caption"
                label="Todos, UI explorer, Patch DB and Peer Store playgrounds"
              />
            </Box>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={theme.colors.icon}
            />
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
}
