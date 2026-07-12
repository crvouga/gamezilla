import { ScreenBase, type ScreenBaseAction } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Trans } from '@lingui/react/macro';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';

import { useFriendMutations } from './friend-action-context';
import { createFriendUserDangerHandlers } from './friend-user-danger-modals';
import { FriendUserScreenContent } from './friend-user-screen-content';
import { FriendsSignedInGate } from './friends-signed-in-gate';
import { useFriendRequestIdsForUser } from './use-friend-request-ids';
import { useFriendshipStatus } from './use-friendship-status';
import { useFriendsClientDeps } from './use-friends-client-deps';
import { useFriendUserOverflowMenu } from './use-friend-user-overflow-menu';
import {
  friendUserBreadcrumbName,
  readRouteParam,
  useFriendUserProfile,
} from './use-friend-user-profile';

function FriendUserScreenBody({ userId }: { userId: string }): ReactNode {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const deps = useFriendsClientDeps();
  const status = useFriendshipStatus(userId);
  const requestIds = useFriendRequestIdsForUser(userId);
  const { profile, refreshProfile } = useFriendUserProfile(userId, deps);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const mutations = useFriendMutations({
    deps,
    userId,
    status,
    incomingRequestId: requestIds.incomingRequestId,
    outgoingRequestId: requestIds.outgoingRequestId,
  });
  const dangerHandlers = createFriendUserDangerHandlers({
    mutations,
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
          deps={deps}
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
