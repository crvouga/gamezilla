import { type ReactNode, useCallback } from 'react';

import { useAcceptFriendRequest } from '../accept-friend-request/use-accept-friend-request';
import { useCancelFriendRequest } from '../cancel-friend-request/use-cancel-friend-request';
import { useDeclineFriendRequest } from '../decline-friend-request/use-decline-friend-request';
import { useSendFriendRequest } from '../send-friend-request/use-send-friend-request';
import { useUnblockUser } from '../unblock-user/use-unblock-user';
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
}: FriendActionPillsProps): ReactNode {
  const sendFriendRequest = useSendFriendRequest();
  const acceptFriendRequest = useAcceptFriendRequest();
  const declineFriendRequest = useDeclineFriendRequest();
  const cancelFriendRequest = useCancelFriendRequest();
  const unblockUser = useUnblockUser();

  const addFriend = useCallback(async () => {
    await sendFriendRequest(ctx.userId);
  }, [sendFriendRequest, ctx.userId]);
  const confirmRequest = useCallback(async () => {
    if (ctx.incomingRequestId === null) return;
    await acceptFriendRequest(ctx.incomingRequestId);
  }, [acceptFriendRequest, ctx.incomingRequestId]);
  const deleteRequest = useCallback(async () => {
    if (ctx.incomingRequestId === null) return;
    await declineFriendRequest(ctx.incomingRequestId);
  }, [declineFriendRequest, ctx.incomingRequestId]);
  const cancelRequest = useCallback(async () => {
    if (ctx.outgoingRequestId === null) return;
    await cancelFriendRequest(ctx.outgoingRequestId);
  }, [cancelFriendRequest, ctx.outgoingRequestId]);
  const unblock = useCallback(async () => {
    await unblockUser(ctx.userId);
  }, [unblockUser, ctx.userId]);

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
