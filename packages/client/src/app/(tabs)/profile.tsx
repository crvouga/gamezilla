import { useRouter } from 'expo-router';
import {
  Avatar,
  Box,
  Button,
  IconSymbol,
  Pressable,
  Text,
} from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/theme';

import { useAuth } from '@/features/auth/auth-context';
import { ScreenHeader } from '@/ui/screen-header';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuth();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="Profile" />
      <Box sx={{ flex: 1, px: 4, pt: 4, gap: 4 }}>
        <Box sx={{ alignItems: 'center', gap: 2 }}>
          <Avatar initials={auth.displayName.slice(0, 2)} size={80} />
          <Text variant="title">{auth.displayName}</Text>
          <Text variant="caption" sx={{ color: 'textSecondary' }}>
            {auth.mode === 'guest' ? 'Signed in as guest' : 'Signed in'}
          </Text>
        </Box>

        <Box sx={{ gap: 2 }}>
          <Button title="Sign in" variant="solid" onPress={() => {}} disabled />
          <Button title="Create account" variant="outlined" onPress={() => {}} disabled />
        </Box>

        <Pressable onPress={() => router.push('/more')}>
          <Box
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 3,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: 'border',
            }}
          >
            <Box>
              <Text variant="bodyBold">Developer</Text>
              <Text variant="caption" sx={{ color: 'textSecondary' }}>
                Internal tools and UI explorer
              </Text>
            </Box>
            <IconSymbol name="chevron.right" color={theme.colors.icon} size={20} />
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
}
