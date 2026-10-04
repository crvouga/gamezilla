import { Handles } from '@libs/test-ids-shared/handles';
import type { UserSearchResult } from '@libs/user-search-shared/user-search-types';
import { useRouter } from '@pkgs/ui-client/app-router';
import type { JSX } from 'solid-js';

import { FriendActionPills } from './friend-action-pills';
import { FriendUserRow } from './friend-user-row';
import { useFriendRequestIdsForUser } from './use-friend-request-ids';
import { useFriendshipStatus } from './use-friendship-status';

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
      pressTestID={Handles.searchUserResultOpen(props.user.username)}
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
