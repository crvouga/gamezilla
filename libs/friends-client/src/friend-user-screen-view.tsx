import { useModeration } from '@libs/moderation-client/moderation-context';
import { Trans } from '@lingui/solid/macro';
import {
  useLocalSearchParams,
  useRouter,
} from '@pkgs/ui-root-client/app-router';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import type { ScreenBaseAction } from '@pkgs/ui-root-client/screen-base-types';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';
import { createFriendUserDangerHandlers } from './friend-user-danger-modals';
import { FriendUserScreenContent } from './friend-user-screen-content';
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

function FriendUserScreenBody(props: { userId: string }): JSX.Element {
  const router = useRouter();
  const userId = () => props.userId;
  const status = useFriendshipStatus(userId);
  const requestIds = useFriendRequestIdsForUser(userId);
  const userProfile = useFriendUserProfile(userId);
  const [removeOpen, setRemoveOpen] = createSignal(false);
  const [blockOpen, setBlockOpen] = createSignal(false);
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const removeFriendForUser = async () => {
    await removeFriend(props.userId);
  };
  const blockUserForUser = async () => {
    await blockUser(props.userId);
  };
  const dangerHandlers = createFriendUserDangerHandlers({
    removeFriend: removeFriendForUser,
    blockUser: blockUserForUser,
    setRemoveOpen,
    setBlockOpen,
    routerBack: () => router.back(),
  });
  const menuActions = useFriendUserOverflowMenu(
    status,
    () => setRemoveOpen(true),
    () => setBlockOpen(true),
    () => userProfile.profile().username
  );
  const headerActions = createMemo((): ScreenBaseAction[] => {
    if (userProfile.unavailable()) return [];
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
    <ScreenBase
      screenId="friend-user"
      breadcrumbs={breadcrumbs()}
      actions={headerActions()}
      content={({ bodyClass }) => (
        <Show
          when={!userProfile.unavailable()}
          fallback={
            <p class="text" data-testid="friend-profile-unavailable">
              <Trans>
                This profile is no longer available because the account was
                deleted.
              </Trans>
            </p>
          }
        >
          <FriendUserScreenContent
            class={bodyClass}
            profile={userProfile.profile()}
            userId={props.userId}
            status={status()}
            incomingRequestId={requestIds.incomingRequestId()}
            outgoingRequestId={requestIds.outgoingRequestId()}
            onChanged={userProfile.refreshProfile}
            removeOpen={removeOpen()}
            blockOpen={blockOpen()}
            onCloseRemove={() => setRemoveOpen(false)}
            onCloseBlock={() => setBlockOpen(false)}
            onRemove={dangerHandlers.onRemove}
            onBlock={dangerHandlers.onBlock}
          />
        </Show>
      )}
    />
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
