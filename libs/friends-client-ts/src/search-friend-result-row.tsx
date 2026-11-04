import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';

import { FriendActionPills } from './friend-action-pills';
import { FriendRequestSentTag } from './friend-action-status-renderers';
import { FriendUserRow } from './friend-user-row';
import { useFriendRequestIdsForUser } from './use-friend-request-ids';
import { useFriendshipStatus } from './use-friendship-status';

/**
 * Fills search's result-row slot: the person, a request that is out as a
 * tag under their name, and the row's one control at its end.
 */
export function SearchFriendResultRow(props: {
  readonly user: UserSearchResult;
  /** What was typed: the part of the name after it is emphasised. */
  readonly query: string;
}): JSX.Element {
  const router = useRouter();
  const userId = () => props.user.userId;
  const status = useFriendshipStatus(userId);
  const requestIds = useFriendRequestIdsForUser(userId);

  return (
    <FriendUserRow
      profile={props.user}
      highlight={props.query}
      subtitle={
        status() === 'pending_outgoing' ? <FriendRequestSentTag /> : undefined
      }
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
