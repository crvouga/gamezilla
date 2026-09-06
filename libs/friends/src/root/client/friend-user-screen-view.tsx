import { Trans } from '@lingui/react/macro';
import {
  ScreenBase,
  type ScreenBaseAction,
  useLocalSearchParams,
  useRouter,
} from '@pkgs/ui-rn';
import { useBreadcrumbNav } from '@pkgs/ui-rn/components/use-breadcrumb-nav';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
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

function FriendUserScreenBody({ userId }: { userId: string }): ReactNode {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const status = useFriendshipStatus(userId);
  const requestIds = useFriendRequestIdsForUser(userId);
  const { profile, refreshProfile } = useFriendUserProfile(userId);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const removeFriendForUser = useCallback(async () => {
    await removeFriend(userId);
  }, [removeFriend, userId]);
  const blockUserForUser = useCallback(async () => {
    await blockUser(userId);
  }, [blockUser, userId]);
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
  const headerActions = useMemo((): ScreenBaseAction[] => {
    return menuActions.map((action) => ({
      type: 'default' as const,
      label: action.label,
      onPress: action.onPress,
      overflow: 'always' as const,
      ...(action.endsGroup === true ? { endsGroup: true } : {}),
    }));
  }, [menuActions]);

  return (
    <ScreenBase
      screenId="friend-user"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onPress: nav('/profile') },
        { name: friendUserBreadcrumbName(profile, userId) },
      ]}
      actions={headerActions}
      content={({ sx }) => (
        <FriendUserScreenContent
          sx={sx}
          profile={profile}
          userId={userId}
          status={status}
          incomingRequestId={requestIds.incomingRequestId}
          outgoingRequestId={requestIds.outgoingRequestId}
          onChanged={refreshProfile}
          removeOpen={removeOpen}
          blockOpen={blockOpen}
          onCloseRemove={() => setRemoveOpen(false)}
          onCloseBlock={() => setBlockOpen(false)}
          onRemove={dangerHandlers.onRemove}
          onBlock={dangerHandlers.onBlock}
        />
      )}
    />
  );
}

export function FriendUserScreen(): ReactNode {
  const { userId: rawUserId } = useLocalSearchParams<{ userId: string }>();
  const userId = readRouteParam(rawUserId);
  return (
    <FriendsSignedInGate>
      {userId.length > 0 ? <FriendUserScreenBody userId={userId} /> : null}
    </FriendsSignedInGate>
  );
}
