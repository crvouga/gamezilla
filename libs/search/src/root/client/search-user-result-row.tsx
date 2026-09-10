import { FriendActionPills } from '@libs/friends/public/friend-action-pills/friend-action-pills';
import { FriendUserRow } from '@libs/friends/public/friend-user-row';
import { useFriendRequestIdsForUser } from '@libs/friends/public/use-friend-request-ids';
import { useFriendshipStatus } from '@libs/friends/public/use-friendship-status';
import type { UserSearchResult } from '@libs/user-search/public/user-search-types';
import { useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export function SearchUserResultRow(props: {
  readonly user: UserSearchResult;
}): JSX.Element {
  const router = useRouter();
  const status = useFriendshipStatus(props.user.userId);
  const requestIds = useFriendRequestIdsForUser(props.user.userId);

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
        <div class="box shrink min-w-[0]">
          <FriendActionPills
            userId={props.user.userId}
            username={props.user.username}
            status={status()}
            incomingRequestId={requestIds.incomingRequestId}
            outgoingRequestId={requestIds.outgoingRequestId}
          />
        </div>
      }
    />
  );
}
