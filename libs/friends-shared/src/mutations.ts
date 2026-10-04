import { blockUserMutation } from './block-user-mutation';
import { acceptFriendRequestMutation } from './accept-friend-request-mutation';
import { cancelFriendRequestMutation } from './cancel-friend-request-mutation';
import { declineFriendRequestMutation } from './decline-friend-request-mutation';
import { sendFriendRequestMutation } from './send-friend-request-mutation';
import { removeFriendMutation } from './remove-friend-mutation';
import { unblockUserMutation } from './unblock-user-mutation';

export const FRIENDS_MUTATIONS = [
  sendFriendRequestMutation,
  acceptFriendRequestMutation,
  declineFriendRequestMutation,
  cancelFriendRequestMutation,
  removeFriendMutation,
  blockUserMutation,
  unblockUserMutation,
] as const;
