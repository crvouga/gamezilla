import {
  Box,
  IconSymbol,
  Pressable,
  ScreenBase,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';

import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';

export default function ProfileEditScreen() {
  const router = useRouter();
  const theme = useTheme();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Profile', onPress: nav('/profile') },
        {
          name: 'Edit profile',
          subtitle: 'Choose what to update',
        },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <Pressable onPress={() => router.push('/profile/username')}>
            <Box
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                py: 3,
                gap: 3,
              }}
            >
              <Box sx={{ flex: 1, gap: 1 }}>
                <Text variant="bodyBold" label="Username" />
                <Text variant="caption" label="Display name shown in the app" />
              </Box>
              <IconSymbol
                name="chevron.right"
                size={20}
                color={theme.colors.icon}
              />
            </Box>
          </Pressable>
          <Pressable onPress={() => router.push('/profile/avatar')}>
            <Box
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                py: 3,
                gap: 3,
              }}
            >
              <Box sx={{ flex: 1, gap: 1 }}>
                <Text variant="bodyBold" label="Avatar" />
                <Text variant="caption" label="DiceBear generated avatar" />
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
