import {
  Box,
  IconSymbol,
  Pressable,
  ScreenBase,
  Text,
  useTheme,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';

import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';

export default function MoreIndex() {
  const router = useRouter();
  const theme = useTheme();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        {
          name: 'Settings',
          subtitle: 'App preferences and tools',
        },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <Pressable onPress={() => router.push('/more/theme')}>
            <Box
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
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
          <Pressable onPress={() => router.push('/more/server-status')}>
            <Box
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                py: 3,
                gap: 3,
              }}
            >
              <Box sx={{ flex: 1, gap: 1 }}>
                <Text variant="bodyBold" label="Connection" />
                <Text
                  variant="caption"
                  label="Network reachability and API server health"
                />
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
      )}
    />
  );
}
