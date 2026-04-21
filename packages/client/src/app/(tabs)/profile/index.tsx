import { ProfileDiceBearAvatar } from '@/features/profile/profile-dicebear-avatar';
import { useProfile } from '@/features/profile/use-profile';
import { Box, Button, Text } from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';

import { ConstrainedContent } from '@/ui/constrained-content';
import { ScreenHeader } from '@/ui/screen-header';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useProfile();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="Profile" showAccountMenu />
      <ConstrainedContent>
        <Box sx={{ flex: 1, px: 4, pt: 4, gap: 4 }}>
          <Box sx={{ alignItems: 'center', gap: 2 }}>
            <ProfileDiceBearAvatar
              config={profile.avatarConfig}
              fallbackSeed={profile.principalId}
              size={80}
              loading={profile.loading}
            />
            {/* Use a non-breaking space while loading to reserve the title
                height so the Edit button below doesn't jump when the real
                label arrives. */}
            <Text
              variant="title"
              label={profile.loading ? '\u00A0' : profile.displayLabel}
            />
          </Box>
          <Box sx={{ mt: 2, alignSelf: 'stretch' }}>
            <Button
              title="Edit profile"
              onPress={() => router.push('/profile/edit')}
            />
          </Box>
        </Box>
      </ConstrainedContent>
    </Box>
  );
}
