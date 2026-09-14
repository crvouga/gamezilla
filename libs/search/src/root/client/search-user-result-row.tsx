import { FriendActionPills } from '@libs/friends/public/friend-action-pills/friend-action-pills';
import { FriendUserRow } from '@libs/friends/public/friend-user-row';
import { useFriendRequestIdsForUser } from '@libs/friends/public/use-friend-request-ids';
import { useFriendshipStatus } from '@libs/friends/public/use-friendship-status';
import type { UserSearchResult } from '@libs/user-search/public/user-search-types';
import { MENU_ROW_PX_STEP, spacingScale, useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export function SearchUserResultRow(props: {
  readonly user: UserSearchResult;
}): JSX.Element {
  const router = useRouter();
  const userId = () => props.user.userId;
  const status = useFriendshipStatus(userId);
  const requestIds = useFriendRequestIdsForUser(userId);
  const edgePx = spacingScale(MENU_ROW_PX_STEP);

  return (
    <div
      class="box self-stretch"
      style={{
        'padding-left': `${edgePx}px`,
        'padding-right': `${edgePx}px`,
      }}
    >
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
    </div>
  );
}
