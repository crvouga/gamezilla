import { Box, ScreenBase } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Trans } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { FriendRequestSections } from './friend-request-sections';
import { FriendsSignedInGate } from './friends-signed-in-gate';
import { fetchFriendRequestsSummary } from './friends-actions';
import { useFriendsClientDeps } from './use-friends-client-deps';
import type {
  EnrichedFriendRequest,
  FriendRequestsSummary,
} from '../shared/friends-types';

function FriendsRequestsBody(): ReactNode {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const deps = useFriendsClientDeps();
  const [summary, setSummary] = useState<FriendRequestsSummary>({
    incoming: [],
    outgoing: [],
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    void fetchFriendRequestsSummary(deps)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openUser = useCallback(
    (request: EnrichedFriendRequest) => {
      const profile = request.otherUser;
      router.push({
        pathname: '/profile/user/[userId]',
        params: {
          userId: profile.userId,
          displayName: profile.displayName,
          username: profile.username,
          avatarConfig: profile.avatarConfig ?? '',
        },
      });
    },
    [router]
  );

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onPress: nav('/profile') },
        { name: <Trans>Friend requests</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 3 }}>
          <FriendRequestSections
            loading={loading}
            incoming={summary.incoming}
            outgoing={summary.outgoing}
            onChanged={reload}
            onPressUser={openUser}
          />
        </Box>
      )}
    />
  );
}

export function FriendsRequestsScreen(): ReactNode {
  return (
    <FriendsSignedInGate>
      <FriendsRequestsBody />
    </FriendsSignedInGate>
  );
}
