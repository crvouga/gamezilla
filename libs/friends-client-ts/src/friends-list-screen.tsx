import type { Friend } from '@libs/friends-shared-ts/friends-types';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useFirstSyncError } from '@libs/profile-client-ts/use-first-sync-error';
import {
  FriendLiveSpaceJoin,
  FriendLiveSpaceStatus,
} from '@libs/spaces-client-ts/friend-live-space';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';
import { FriendsListScreenView } from './friends-list-screen-view';
import { FriendsRefusedChangeNotice } from './friends-refused-change-notice';
import { useFriends } from './use-friends';

/** Navigation shared by the allowed and denied states of the screen. */
function useFriendsListNavigation() {
  const router = useRouter();
  return {
    onOpenFriend: (friend: Friend) =>
      router.push({
        pathname: '/profile/user/[userId]',
        params: {
          userId: friend.userId,
          username: friend.username,
          avatarConfig: friend.avatarConfig ?? '',
        },
      }),
    onFindFriends: () => router.push('/search'),
  };
}

function FriendsListContainer(): JSX.Element {
  const engine = useSyncEngine();
  const firstSyncError = useFirstSyncError();
  const friendsState = useFriends();
  const navigation = useFriendsListNavigation();
  const status = () => {
    if (friendsState.isLoading()) return 'loading';
    return firstSyncError() ? 'failed' : 'ready';
  };
  return (
    <FriendsListScreenView
      status={status()}
      friends={friendsState.friends()}
      notice={<FriendsRefusedChangeNotice />}
      friendStatus={(friend) => (
        <FriendLiveSpaceStatus hostAccountId={friend.userId} />
      )}
      friendTrailing={(friend) => (
        <FriendLiveSpaceJoin hostAccountId={friend.userId} />
      )}
      onOpenFriend={navigation.onOpenFriend}
      onFindFriends={navigation.onFindFriends}
      onRetry={() => void engine.refreshQueries()}
    />
  );
}

/** `/profile/friends`: wires `FriendsListScreenView` to permissions and sync. */
export function FriendsListScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.friendsUse);
  const navigation = useFriendsListNavigation();
  return (
    <DecisionGate
      decision={decision()}
      icon={UsersIcon}
      denied={(denial) => (
        <FriendsListScreenView
          status="ready"
          friends={[]}
          denial={denial}
          onOpenFriend={navigation.onOpenFriend}
          onFindFriends={navigation.onFindFriends}
          onRetry={() => undefined}
        />
      )}
    >
      <FriendsListContainer />
    </DecisionGate>
  );
}
