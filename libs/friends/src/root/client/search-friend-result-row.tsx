import type { UserSearchResult } from '@libs/user-search/public/user-search-types';
import { useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { FriendActionPills } from '../../public/friend-action-pills/friend-action-pills';
import { FriendUserRow } from '../../public/friend-user-row';
import { useFriendRequestIdsForUser } from '../../public/use-friend-request-ids';
import { useFriendshipStatus } from '../../public/use-friendship-status';

/** Fills search's result-row slot: the person, their status, the pills. */
export function SearchFriendResultRow(props: {
  readonly user: UserSearchResult;
}): JSX.Element {
  const router = useRouter();
  const userId = () => props.user.userId;
  const status = useFriendshipStatus(userId);
  const requestIds = useFriendRequestIdsForUser(userId);

  return (
    <FriendUserRow
      profile={props.user}
      onPress={() =>
        router.push({
          pathname: '/profile/user/[userId]',
          params: {
            userId: props.user.userId,
            username: props.user.username,
            avatarConfig: props.user.avatarConfig ?? '',
          },
        })
      }
      trailing={
        <FriendActionPills
          userId={props.user.userId}
          username={props.user.username}
          status={status()}
          incomingRequestId={requestIds.incomingRequestId()}
          outgoingRequestId={requestIds.outgoingRequestId()}
        />
      }
    />
  );
}
