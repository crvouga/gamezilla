import type { JSX } from 'solid-js';
import { useAcceptFriendRequest } from '../../use-cases/friend-request-accept/client/use-accept-friend-request';
import { useCancelFriendRequest } from '../../use-cases/friend-request-cancel/client/use-cancel-friend-request';
import { useDeclineFriendRequest } from '../../use-cases/friend-request-decline/client/use-decline-friend-request';
import { useSendFriendRequest } from '../../use-cases/friend-request-send/client/use-send-friend-request';
import { useUnblockUser } from '../../use-cases/unblock-user/client/use-unblock-user';
import { FriendActionPillsForStatus } from './friend-action-pills-by-status';
import type {
  FriendActionMutations,
  FriendActionPillsProps,
} from './friend-action-types';

export type {
  FriendActionMutations,
  FriendActionPillsComponent,
  FriendActionPillsProps,
} from './friend-action-types';

export function FriendActionPills({
  onChanged,
  ...ctx
}: FriendActionPillsProps): JSX.Element {
  const sendFriendRequest = useSendFriendRequest();
  const acceptFriendRequest = useAcceptFriendRequest();
  const declineFriendRequest = useDeclineFriendRequest();
  const cancelFriendRequest = useCancelFriendRequest();
  const unblockUser = useUnblockUser();

  const addFriend = async () => {
    await sendFriendRequest(ctx.userId);
  };
  const confirmRequest = async () => {
    if (ctx.incomingRequestId === null) return;
    await acceptFriendRequest(ctx.incomingRequestId);
  };
  const deleteRequest = async () => {
    if (ctx.incomingRequestId === null) return;
    await declineFriendRequest(ctx.incomingRequestId);
  };
  const cancelRequest = async () => {
    if (ctx.outgoingRequestId === null) return;
    await cancelFriendRequest(ctx.outgoingRequestId);
  };
  const unblock = async () => {
    await unblockUser(ctx.userId);
  };

  const mutations: FriendActionMutations = {
    addFriend,
    confirmRequest,
    deleteRequest,
    cancelRequest,
    unblock,
  };

  return (
    <FriendActionPillsForStatus
      status={ctx.status}
      mutations={mutations}
      onChanged={onChanged}
      {...(ctx.username !== undefined ? { username: ctx.username } : {})}
    />
  );
}
