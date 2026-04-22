import { ProfileDiceBearAvatar } from '@gamezilla/client/features/profile/profile-dicebear-avatar';
import { useProfile } from '@gamezilla/client/features/profile/use-profile';
import {
  Box,
  Button,
  ScreenBase,
  Text,
  useBreakpoint,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';

import { useAccountActions } from '@gamezilla/client/ui/use-account-actions';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useProfile();
  const accountActions = useAccountActions();
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <ScreenBase
      breadcrumbs={[{ name: 'Profile' }]}
      actions={isMobile ? accountActions : []}
      content={({ sx }) => (
        <Box style={sx}>
          <Box sx={{ alignItems: 'center', gap: 2 }}>
            <ProfileDiceBearAvatar
              config={profile.avatarConfig}
              fallbackSeed={profile.principalId}
              size={80}
              loading={profile.loading}
            />
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
      )}
    />
  );
}
