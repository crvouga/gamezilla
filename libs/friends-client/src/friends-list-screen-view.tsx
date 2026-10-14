import type { Friend } from '@libs/friends-shared/friends-types';
import { FriendLiveSpaceBadge } from '@libs/spaces-client/friend-live-space-badge';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { CollectionScreen } from '@pkgs/ui-root-client/collection-screen';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { UserPlusIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client/screen-body-virtual-list';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { FriendUserRow } from './friend-user-row';
import { FriendsPermissionGate } from './friends-permission-gate';
import { useFriends } from './use-friends';

function FriendsEmptyState(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  return (
    <EmptyState
      icon={UserPlusIcon}
      title={<Trans>No friends yet</Trans>}
      body={
        <Trans>Search for people by username to send a friend request.</Trans>
      }
      action={{ label: t`Find friends`, onClick: () => router.push('/search') }}
      dataSet={{ testid: Handles.friendsEmpty }}
    />
  );
}

function FriendsListBody(): JSX.Element {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const friendsState = useFriends();

  const openUser = (friend: Friend) => {
    router.push({
      pathname: '/profile/user/[userId]',
      params: {
        userId: friend.userId,
        username: friend.username,
        avatarConfig: friend.avatarConfig ?? '',
      },
    });
  };

  return (
    <CollectionScreen
      screenId="friends-list"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onClick: nav('/profile') },
        { name: <Trans>Friends</Trans> },
      ]}
    >
      <ScreenBodyVirtualList
        items={friendsState.friends()}
        keyExtractor={(item) => item.userId}
        estimateSize={72}
        empty={
          friendsState.isLoading() ? <LoadingState /> : <FriendsEmptyState />
        }
        renderItem={(item) => (
          <FriendUserRow
            profile={item}
            onPress={() => openUser(item)}
            friendsListHandle
            trailing={<FriendLiveSpaceBadge hostAccountId={item.userId} />}
          />
        )}
      />
    </CollectionScreen>
  );
}

export function FriendsListScreen(): JSX.Element {
  return (
    <FriendsPermissionGate>
      <FriendsListBody />
    </FriendsPermissionGate>
  );
}
