import {
  Box,
  IconSymbol,
  Pressable,
  Text,
  useTheme,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';

import { ConstrainedContent } from '@/ui/constrained-content';
import { ScreenHeader } from '@/ui/screen-header';

export default function ProfileEditScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title="Edit profile"
        subtitle="Choose what to update"
        fallbackHref="/profile"
      />
      <ConstrainedContent>
        <Box sx={{ flex: 1, py: 2 }}>
          <Pressable onPress={() => router.push('/profile/username')}>
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
                px: 4,
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
      </ConstrainedContent>
    </Box>
  );
}
