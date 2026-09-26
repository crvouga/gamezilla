import { FriendLiveSpaceBadge } from '@libs/spaces/public/friend-live-space-badge';
import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  EmptyState,
  LoadingState,
  ScreenBase,
  ScreenBodyVirtualList,
  UserPlusIcon,
  useBreadcrumbNav,
  useRouter,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { FriendUserRow } from '../../public/friend-user-row';
import type { Friend } from '../../shared/friendship/friends-types';
import { useFriends } from '../../use-cases/list-friends/client/use-friends';
import { FriendsPermissionGate } from './friends-permission-gate';

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
    <ScreenBase
      screenId="friends-list"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onClick: nav('/profile') },
        { name: <Trans>Friends</Trans> },
      ]}
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass}`}>
          <ScreenBodyVirtualList
            items={friendsState.friends()}
            keyExtractor={(item) => item.userId}
            estimateSize={72}
            empty={
              friendsState.isLoading() ? (
                <LoadingState />
              ) : (
                <FriendsEmptyState />
              )
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
        </div>
      )}
    />
  );
}

export function FriendsListScreen(): JSX.Element {
  return (
    <FriendsPermissionGate>
      <FriendsListBody />
    </FriendsPermissionGate>
  );
}
