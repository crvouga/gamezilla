import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/react/macro';
import { Box, Pressable, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useFriends } from '../../use-cases/list-friends/client/use-friends';
import { FriendsProfileRoute } from './friends-profile-routes';
import { useFriendsProfileNavigation } from './use-friends-profile-chrome';

export function ProfileFriendsStats(): ReactNode {
  const navigate = useFriendsProfileNavigation();
  const { t } = useLingui();
  const { friends } = useFriends();

  return (
    <Pressable
      onPress={() => navigate(FriendsProfileRoute.Friends)}
      sx={{ alignSelf: 'stretch' }}
      testID={Handles.profileFriendsStats}
    >
      <Box sx={{ alignItems: 'center', py: 1 }}>
        <Text variant="title" label={String(friends.length)} />
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={t`Friends`}
        />
      </Box>
    </Pressable>
  );
}
