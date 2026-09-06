import { FriendLiveSpaceBadge } from '@libs/spaces/public/friend-live-space-badge';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSyncEngineActions } from '@pkgs/sync-engine/client';
import {
  Box,
  EmptyState,
  LoadingState,
  ScreenBase,
  ScreenBodyLegendList,
  UserPlusIcon,
  useRouter,
} from '@pkgs/ui-rn';
import { useBreadcrumbNav } from '@pkgs/ui-rn/components/use-breadcrumb-nav';
import { type ReactNode, useCallback } from 'react';
import { FriendUserRow } from '../../public/friend-user-row';
import type { Friend } from '../../shared/friendship/friends-types';
import { useFriends } from '../../use-cases/list-friends/client/use-friends';
import { FriendsSignedInGate } from './friends-signed-in-gate';

function FriendsEmptyState(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  return (
    <EmptyState
      icon={UserPlusIcon}
      title={<Trans>No friends yet</Trans>}
      body={
        <Trans>Search for people by username to send a friend request.</Trans>
      }
      action={{ label: t`Find friends`, onPress: () => router.push('/search') }}
    />
  );
}

function FriendsListBody(): ReactNode {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const { friends, isLoading } = useFriends();
  const { refreshQueries } = useSyncEngineActions();

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
        <Box sx={sx}>
          <ScreenBodyLegendList
            data={friends}
            keyExtractor={(item) => item.userId}
            estimatedItemSize={72}
            drawDistance={200}
            onRefresh={() => refreshQueries()}
            sx={{ flexGrow: 1 }}
            ListEmptyComponent={
              isLoading ? <LoadingState /> : <FriendsEmptyState />
            }
            renderItem={({ item }) => (
              <FriendUserRow
                profile={item}
                onPress={() => openUser(item)}
                friendsListHandle
                trailing={<FriendLiveSpaceBadge hostAccountId={item.userId} />}
              />
            )}
          />
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
