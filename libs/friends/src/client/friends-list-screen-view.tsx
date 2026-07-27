import { Box, Button, ScreenBase, ScreenBodyFlatList, Text } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { FriendLiveSpaceBadge } from '@libs/spaces/client/friend-live-space-badge';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';

import { FriendUserRow } from './friend-user-row';
import { FriendsSignedInGate } from './friends-signed-in-gate';
import { useFriends } from './use-friends';
import type { Friend } from '../shared/friends-types';

function FriendsListBody(): ReactNode {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const { t } = useLingui();
  const { friends, isLoading } = useFriends();

  const openUser = useCallback(
    (friend: Friend) => {
      router.push({
        pathname: '/profile/user/[userId]',
        params: {
          userId: friend.userId,
          username: friend.username,
          avatarConfig: friend.avatarConfig ?? '',
        },
      });
    },
    [router]
  );

  return (
    <ScreenBase
      screenId="friends-list"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onPress: nav('/profile') },
        { name: <Trans>Friends</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          {friends.length === 0 && !isLoading ? (
            <Box sx={{ gap: 2, py: 4, alignItems: 'center' }}>
              <Text variant="body" label={t`No friends yet`} />
              <Button
                title={t`Find friends`}
                onPress={() => router.push('/search')}
              />
            </Box>
          ) : (
            <ScreenBodyFlatList
              data={friends}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <FriendUserRow
                  profile={item}
                  onPress={() => openUser(item)}
                  trailing={
                    <FriendLiveSpaceBadge hostAccountId={item.userId} />
                  }
                />
              )}
            />
          )}
        </Box>
      )}
    />
  );
}

export function FriendsListScreen(): ReactNode {
  return (
    <FriendsSignedInGate>
      <FriendsListBody />
    </FriendsSignedInGate>
  );
}
