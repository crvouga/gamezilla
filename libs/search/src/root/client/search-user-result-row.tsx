import { FriendActionPills } from '@libs/friends/public/friend-action-pills/friend-action-pills';
import { FriendUserRow } from '@libs/friends/public/friend-user-row';
import { useFriendRequestIdsForUser } from '@libs/friends/public/use-friend-request-ids';
import { useFriendshipStatus } from '@libs/friends/public/use-friendship-status';
import type { UserSearchResult } from '@libs/user-search/public/user-search-types';
import { Box, useRouter } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

export function SearchUserResultRow({
  user,
}: {
  user: UserSearchResult;
}): ReactNode {
  const router = useRouter();
  const status = useFriendshipStatus(user.userId);
  const requestIds = useFriendRequestIdsForUser(user.userId);

  return (
    <FriendUserRow
      profile={user}
      onPress={() =>
        router.push({
          pathname: '/profile/user/[userId]',
          params: {
            userId: user.userId,
            username: user.username,
            avatarConfig: user.avatarConfig ?? '',
          },
        })
      }
      trailing={
        <Box sx={{ flexShrink: 1, minWidth: 0 }}>
          <FriendActionPills
            userId={user.userId}
            username={user.username}
            status={status}
            incomingRequestId={requestIds.incomingRequestId}
            outgoingRequestId={requestIds.outgoingRequestId}
          />
        </Box>
      }
    />
  );
}
