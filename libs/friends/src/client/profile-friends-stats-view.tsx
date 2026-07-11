import { Box, Pressable, Text } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { FriendsProfileRoute } from './friends-profile-routes';
import { useFriendsProfileNavigation } from './use-friends-profile-chrome';
import { useFriends } from './use-friends';

export function ProfileFriendsStats(): ReactNode {
  const navigate = useFriendsProfileNavigation();
  const { t } = useLingui();
  const { friends } = useFriends();

  return (
    <Pressable
      onPress={() => navigate(FriendsProfileRoute.Friends)}
      style={{ alignSelf: 'stretch' }}
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
