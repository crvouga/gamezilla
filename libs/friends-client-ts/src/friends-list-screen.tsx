import type { Friend } from '@libs/friends-shared-ts/friends-types';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useFirstSyncError } from '@libs/profile-client-ts/use-first-sync-error';
import { FriendLiveSpaceJoin } from '@libs/spaces-client-ts/friend-live-space';
import { useLiveSpacesByPerson } from '@libs/spaces-client-ts/use-live-spaces-by-person';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { createMemo, type JSX, Show } from 'solid-js';
import { FriendRequestsAside } from './friend-requests-aside';
import { FriendRequestsEntry } from './friend-requests-entry';
import { FriendRowDisclosure } from './friend-user-row';
import { FriendsListScreenView } from './friends-list-screen-view';
import {
  FriendRoomStatusView,
  liveFriendsFirst,
  roomsByFriend,
  usePlayingRooms,
} from './friends-playing-now';
import { FriendsRefusedChangeNotice } from './friends-refused-change-notice';
import { useFriendRequests } from './use-friend-requests';
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
  const live = useLiveSpacesByPerson();
  // Who you can play with now leads the list: hosts, then guests, then the
  // rest, each in the list's own order.
  const ordered = createMemo(() =>
    liveFriendsFirst(friendsState.friends(), live())
  );
  // The room each live friend is in, so their row names it by its tile.
  const rooms = usePlayingRooms(friendsState.friends);
  const roomOf = createMemo(() => roomsByFriend(rooms()));
  // Beside the list on a desktop: who is waiting on an answer. Every Join
  // is on its friend's row, so the column never repeats one. Built once
  // per appearance: the column is read more than once per render.
  const requests = useFriendRequests();
  const waiting = createMemo(
    () => requests.incoming().length > 0 || requests.outgoing().length > 0
  );
  const aside = createMemo(() =>
    waiting() ? <FriendRequestsAside /> : undefined
  );
  const status = () => {
    if (friendsState.isLoading()) return 'loading';
    return firstSyncError() ? 'failed' : 'ready';
  };
  return (
    <FriendsListScreenView
      status={status()}
      friends={ordered()}
      notice={<FriendsRefusedChangeNotice />}
      aside={aside()}
      requests={<FriendRequestsEntry />}
      friendStatus={(friend) => (
        <Show when={roomOf().get(friend.userId)}>
          {(live) => (
            <FriendRoomStatusView room={live().room} hosting={live().hosting} />
          )}
        </Show>
      )}
      friendTrailing={(friend) => (
        <FriendLiveSpaceJoin
          hostAccountId={friend.userId}
          fallback={<FriendRowDisclosure />}
        />
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
