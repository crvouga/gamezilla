import type { FriendActionMutations } from '@libs/friends-shared-ts/friend-action-types';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import type { FriendUserPresence } from './friend-user-screen-content';
import {
  type FriendUserConfirming,
  FriendUserScreenView,
} from './friend-user-screen-view';
import { FriendsRefusedChangeNotice } from './friends-refused-change-notice';
import { useBlockUser } from './use-block-user';
import { useFriendActionMutations } from './use-friend-action-mutations';
import { useFriendRequestFeedback } from './use-friend-request-feedback';
import { useFriendRequestIdsForUser } from './use-friend-request-ids';
import {
  readRouteParam,
  useFriendUserProfile,
} from './use-friend-user-profile';
import { useFriendshipStatus } from './use-friendship-status';
import { useRemoveFriend } from './use-remove-friend';

/** Loading, unreachable (never synced), withdrawn, or shown. */
function useFriendUserPresence(
  userProfile: ReturnType<typeof useFriendUserProfile>
): () => FriendUserPresence {
  return () => {
    if (userProfile.unreachable()) return 'unreachable';
    if (userProfile.loading()) return 'loading';
    if (!userProfile.unavailable()) return 'shown';
    return 'unavailable';
  };
}

function useFriendUserDanger(userId: () => string) {
  const [confirming, setConfirming] = createSignal<FriendUserConfirming>(null);
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const handlers = {
    onRemove: () => removeFriend(userId()),
    onBlock: () => blockUser(userId()),
  };
  return { confirming, setConfirming, handlers };
}

function FriendUserScreenBody(props: { userId: string }): JSX.Element {
  const userId = () => props.userId;
  const status = useFriendshipStatus(userId);
  const requestIds = useFriendRequestIdsForUser(userId);
  const userProfile = useFriendUserProfile(userId);
  const presence = useFriendUserPresence(userProfile);
  const danger = useFriendUserDanger(userId);
  const actions = useFriendActionMutations({
    userId,
    incomingRequestId: requestIds.incomingRequestId,
    outgoingRequestId: requestIds.outgoingRequestId,
  });
  const requestOutcome = useFriendRequestFeedback({
    userId,
    outgoingRequestId: requestIds.outgoingRequestId,
  });
  return (
    <FriendUserScreenView
      presence={presence()}
      profile={userProfile.profile()}
      status={status()}
      requestOutcome={requestOutcome()}
      actions={actions.mutations}
      addFailureCode={actions.addFailureCode()}
      confirming={danger.confirming()}
      notice={<FriendsRefusedChangeNotice />}
      onRetry={userProfile.refreshProfile}
      onChanged={userProfile.refreshProfile}
      onRequestRemove={() => danger.setConfirming('remove')}
      onRequestBlock={() => danger.setConfirming('block')}
      onCancelConfirm={() => danger.setConfirming(null)}
      onRemove={danger.handlers.onRemove}
      onBlock={danger.handlers.onBlock}
    />
  );
}

const NO_MUTATIONS: FriendActionMutations = {
  addFriend: () => Promise.resolve(),
  confirmRequest: () => Promise.resolve(),
  deleteRequest: () => Promise.resolve(),
  cancelRequest: () => Promise.resolve(),
  unblock: () => Promise.resolve(),
};

/** `/profile/user/:userId`: wires `FriendUserScreenView` to permissions, sync and mutations. */
export function FriendUserScreen(): JSX.Element {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = () => readRouteParam(params().userId);
  const decision = useDecision(PERMISSION.friendsUse);
  return (
    <DecisionGate
      decision={decision()}
      icon={UsersIcon}
      denied={(denial) => (
        <FriendUserScreenView
          presence="loading"
          profile={{ userId: userId(), username: '', avatarConfig: null }}
          status="none"
          requestOutcome={null}
          actions={NO_MUTATIONS}
          addFailureCode={null}
          confirming={null}
          denial={denial}
          onRetry={() => undefined}
          onChanged={() => undefined}
          onRequestRemove={() => undefined}
          onRequestBlock={() => undefined}
          onCancelConfirm={() => undefined}
          onRemove={() => Promise.resolve()}
          onBlock={() => Promise.resolve()}
        />
      )}
    >
      <Show when={userId()} keyed>
        {(id) => <FriendUserScreenBody userId={id} />}
      </Show>
    </DecisionGate>
  );
}
