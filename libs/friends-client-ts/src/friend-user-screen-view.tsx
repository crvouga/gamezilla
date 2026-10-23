import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { useFirstSyncError } from '@libs/profile-client-ts/use-first-sync-error';
import { Trans } from '@lingui/solid/macro';
import {
  useLocalSearchParams,
  useRouter,
} from '@pkgs/ui-root-client-ts/app-router';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import type { ScreenBaseAction } from '@pkgs/ui-root-client-ts/screen-base-types';
import { useBreadcrumbNav } from '@pkgs/ui-root-client-ts/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';
import {
  createFriendUserDangerHandlers,
  FriendUserDangerModals,
} from './friend-user-danger-modals';
import type { FriendUserPresence } from './friend-user-screen-content';
import {
  FriendUserIdentity,
  FriendUserIdentityActions,
} from './friend-user-screen-content';
import { FriendsPermissionGate } from './friends-permission-gate';
import { useBlockUser } from './use-block-user';
import { useFriendRequestIdsForUser } from './use-friend-request-ids';
import { useFriendUserOverflowMenu } from './use-friend-user-overflow-menu';
import {
  friendUserBreadcrumbName,
  readRouteParam,
  useFriendUserProfile,
} from './use-friend-user-profile';
import { useFriendshipStatus } from './use-friendship-status';
import { useRemoveFriend } from './use-remove-friend';

/** Profile › the person, named as moderation lets them be shown. */
function useFriendUserBreadcrumbs(
  userProfile: ReturnType<typeof useFriendUserProfile>,
  userId: () => string
) {
  const nav = useBreadcrumbNav();
  const moderation = useModeration();
  return createMemo(() => [
    { name: <Trans>Profile</Trans>, onClick: nav('/profile') },
    {
      name: friendUserBreadcrumbName(
        moderation(),
        userProfile.profile(),
        userId()
      ),
    },
  ]);
}

/** Loading, unreachable (never synced), withdrawn, or shown. */
function useFriendUserPresence(
  userProfile: ReturnType<typeof useFriendUserProfile>
): () => FriendUserPresence {
  const firstSyncError = useFirstSyncError();
  return () => {
    if (userProfile.loading()) return 'loading';
    if (!userProfile.unavailable()) return 'shown';
    return firstSyncError() ? 'unreachable' : 'unavailable';
  };
}

function useFriendUserDanger(userId: () => string) {
  const router = useRouter();
  const [removeOpen, setRemoveOpen] = createSignal(false);
  const [blockOpen, setBlockOpen] = createSignal(false);
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const handlers = createFriendUserDangerHandlers({
    removeFriend: () => removeFriend(userId()),
    blockUser: () => blockUser(userId()),
    setRemoveOpen,
    setBlockOpen,
    routerBack: () => router.back(),
  });
  return { removeOpen, setRemoveOpen, blockOpen, setBlockOpen, handlers };
}

function FriendUserScreenBody(props: { userId: string }): JSX.Element {
  const userId = () => props.userId;
  const status = useFriendshipStatus(userId);
  const requestIds = useFriendRequestIdsForUser(userId);
  const userProfile = useFriendUserProfile(userId);
  const presence = useFriendUserPresence(userProfile);
  const danger = useFriendUserDanger(userId);
  const menuActions = useFriendUserOverflowMenu(
    status,
    () => danger.setRemoveOpen(true),
    () => danger.setBlockOpen(true),
    () => userProfile.profile().username
  );
  const headerActions = createMemo((): ScreenBaseAction[] => {
    if (presence() !== 'shown') return [];
    return menuActions().map((action) => ({
      type: 'default' as const,
      label: action.label,
      onClick: action.onPress,
      overflow: 'always' as const,
      ...(action.endsGroup === true ? { endsGroup: true } : {}),
      dataSet: action.dataSet,
    }));
  });
  const breadcrumbs = useFriendUserBreadcrumbs(userProfile, userId);

  return (
    <ProfileScreenLayout
      screenId="friend-user"
      breadcrumbs={breadcrumbs()}
      actions={headerActions()}
      identity={
        <FriendUserIdentity
          presence={presence()}
          profile={userProfile.profile()}
          outgoingRequestId={requestIds.outgoingRequestId()}
          onRetry={userProfile.refreshProfile}
        />
      }
      identityActions={
        <Show when={presence() === 'shown'}>
          <FriendUserIdentityActions
            profile={userProfile.profile()}
            status={status()}
            incomingRequestId={requestIds.incomingRequestId()}
            outgoingRequestId={requestIds.outgoingRequestId()}
            onChanged={userProfile.refreshProfile}
          />
        </Show>
      }
    >
      <Show when={presence() === 'shown'}>
        <FriendUserDangerModals
          username={userProfile.profile().username}
          removeOpen={danger.removeOpen()}
          blockOpen={danger.blockOpen()}
          onCloseRemove={() => danger.setRemoveOpen(false)}
          onCloseBlock={() => danger.setBlockOpen(false)}
          onRemove={danger.handlers.onRemove}
          onBlock={danger.handlers.onBlock}
        />
      </Show>
    </ProfileScreenLayout>
  );
}

export function FriendUserScreen(): JSX.Element {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = () => readRouteParam(params().userId);
  return (
    <FriendsPermissionGate>
      <Show when={userId()} keyed>
        {(id) => <FriendUserScreenBody userId={id} />}
      </Show>
    </FriendsPermissionGate>
  );
}
