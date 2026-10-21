import { RefusedChangeNotice } from '@libs/app-root-client/refused-change-notice';
import { blockUserMutation } from '@libs/friends-shared/block-user-mutation';
import { cancelFriendRequestMutation } from '@libs/friends-shared/cancel-friend-request-mutation';
import { declineFriendRequestMutation } from '@libs/friends-shared/decline-friend-request-mutation';
import { removeFriendMutation } from '@libs/friends-shared/remove-friend-mutation';
import { unblockUserMutation } from '@libs/friends-shared/unblock-user-mutation';
import type { JSX } from 'solid-js';

/** Changes to who someone is to the person, told where friends are shown. */
const FRIEND_CHANGES: readonly string[] = [
  blockUserMutation.name,
  unblockUserMutation.name,
  removeFriendMutation.name,
  cancelFriendRequestMutation.name,
  declineFriendRequestMutation.name,
];

/** A refused friend change, inline on the friends list or a profile. */
export function FriendsRefusedChangeNotice(): JSX.Element {
  return <RefusedChangeNotice mutations={FRIEND_CHANGES} />;
}
