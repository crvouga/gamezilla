import { Box, Pressable, Text } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { FriendsProfileRoute } from './friends-profile-routes';
import { useFriendsProfileNavigation } from './use-friends-profile-chrome';
import { useIncomingFriendRequests } from './use-friend-requests';
import { useFriends } from './use-friends';

type ProfileStatItemProps = {
  readonly count: number;
  readonly label: string;
  readonly onPress: () => void;
};

function ProfileStatItem({
  count,
  label,
  onPress,
}: ProfileStatItemProps): ReactNode {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Box sx={{ alignItems: 'center', py: 1 }}>
        <Text variant="title" label={String(count)} />
        <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
      </Box>
    </Pressable>
  );
}

function ProfileStatDivider(): ReactNode {
  return (
    <Box
      sx={{
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: 'border',
        my: 1,
      }}
    />
  );
}

export function ProfileFriendsStats(): ReactNode {
  const navigate = useFriendsProfileNavigation();
  const { t } = useLingui();
  const { friends } = useFriends();
  const { requests: incoming } = useIncomingFriendRequests();

  return (
    <Box
      sx={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}
    >
      <ProfileStatItem
        count={friends.length}
        label={t`Friends`}
        onPress={() => navigate(FriendsProfileRoute.Friends)}
      />
      <ProfileStatDivider />
      <ProfileStatItem
        count={incoming.length}
        label={t`Requests`}
        onPress={() => navigate(FriendsProfileRoute.Requests)}
      />
    </Box>
  );
}
