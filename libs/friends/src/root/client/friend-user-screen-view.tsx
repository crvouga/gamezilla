import { Trans } from '@lingui/solid/macro';
import {
  ScreenBase,
  type ScreenBaseAction,
  useBreadcrumbNav,
  useLocalSearchParams,
  useRouter,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';
import { useFriendRequestIdsForUser } from '../../public/use-friend-request-ids';
import { useFriendshipStatus } from '../../public/use-friendship-status';
import { useBlockUser } from '../../use-cases/block-user/client/use-block-user';
import { useRemoveFriend } from '../../use-cases/remove-friend/client/use-remove-friend';
import { createFriendUserDangerHandlers } from './friend-user-danger-modals';
import { FriendUserScreenContent } from './friend-user-screen-content';
import { FriendsSignedInGate } from './friends-signed-in-gate';
import { useFriendUserOverflowMenu } from './use-friend-user-overflow-menu';
import {
  friendUserBreadcrumbName,
  readRouteParam,
  useFriendUserProfile,
} from './use-friend-user-profile';

function FriendUserScreenBody(props: { userId: string }): JSX.Element {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const status = useFriendshipStatus(props.userId);
  const requestIds = useFriendRequestIdsForUser(props.userId);
  const userProfile = useFriendUserProfile(props.userId);
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
    () => setBlockOpen(true)
  );
  const headerActions = createMemo((): ScreenBaseAction[] => {
    return menuActions().map((action) => ({
      type: 'default' as const,
      label: action.label,
      onClick: action.onPress,
      overflow: 'always' as const,
      ...(action.endsGroup === true ? { endsGroup: true } : {}),
    }));
  });
  const breadcrumbs = createMemo(() => [
    { name: <Trans>Profile</Trans>, onClick: nav('/profile') },
    { name: friendUserBreadcrumbName(userProfile.profile, props.userId) },
  ]);

  return (
    <ScreenBase
      screenId="friend-user"
      breadcrumbs={breadcrumbs()}
      actions={headerActions()}
      content={({ bodyClass }) => (
        <FriendUserScreenContent
          class={bodyClass}
          profile={userProfile.profile}
          userId={props.userId}
          status={status()}
          incomingRequestId={requestIds.incomingRequestId}
          outgoingRequestId={requestIds.outgoingRequestId}
          onChanged={userProfile.refreshProfile}
          removeOpen={removeOpen()}
          blockOpen={blockOpen()}
          onCloseRemove={() => setRemoveOpen(false)}
          onCloseBlock={() => setBlockOpen(false)}
          onRemove={dangerHandlers.onRemove}
          onBlock={dangerHandlers.onBlock}
        />
      )}
    />
  );
}

export function FriendUserScreen(): JSX.Element {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = () => readRouteParam(params().userId);
  return (
    <FriendsSignedInGate>
      <Show when={userId().length > 0}>
        <FriendUserScreenBody userId={userId()} />
      </Show>
    </FriendsSignedInGate>
  );
}
