import { blockUserMutation } from '../use-cases/block-user/shared/block-user-mutation';
import { acceptFriendRequestMutation } from '../use-cases/friend-request-accept/shared/accept-friend-request-mutation';
import { cancelFriendRequestMutation } from '../use-cases/friend-request-cancel/shared/cancel-friend-request-mutation';
import { declineFriendRequestMutation } from '../use-cases/friend-request-decline/shared/decline-friend-request-mutation';
import { sendFriendRequestMutation } from '../use-cases/friend-request-send/shared/send-friend-request-mutation';
import { removeFriendMutation } from '../use-cases/remove-friend/shared/remove-friend-mutation';
import { unblockUserMutation } from '../use-cases/unblock-user/shared/unblock-user-mutation';

export const FRIENDS_MUTATIONS = [
  sendFriendRequestMutation,
  acceptFriendRequestMutation,
  declineFriendRequestMutation,
  cancelFriendRequestMutation,
  removeFriendMutation,
  blockUserMutation,
  unblockUserMutation,
] as const;
