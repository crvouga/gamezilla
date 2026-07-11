import { useCallback, type ReactNode } from 'react';

import type { FriendshipStatus } from '../shared/friends-types';
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
  unblockUser,
  type FriendsClientDeps,
} from './friends-actions';

export type FriendActionContext = {
  readonly deps: FriendsClientDeps;
  readonly userId: string;
  readonly status: FriendshipStatus;
  readonly incomingRequestId: string | null;
  readonly outgoingRequestId: string | null;
};

export function useFriendMutations(ctx: FriendActionContext) {
  const { deps, userId, incomingRequestId, outgoingRequestId } = ctx;

  const addFriend = useCallback(async () => {
    await sendFriendRequest(deps, userId);
  }, [deps, userId]);

  const confirmRequest = useCallback(async () => {
    if (incomingRequestId === null) return;
    await acceptFriendRequest(deps, incomingRequestId);
  }, [deps, incomingRequestId]);

  const deleteRequest = useCallback(async () => {
    if (incomingRequestId === null) return;
    await declineFriendRequest(deps, incomingRequestId);
  }, [deps, incomingRequestId]);

  const cancelRequest = useCallback(async () => {
    if (outgoingRequestId === null) return;
    await cancelFriendRequest(deps, outgoingRequestId);
  }, [deps, outgoingRequestId]);

  const remove = useCallback(async () => {
    await removeFriend(deps, userId);
  }, [deps, userId]);

  const block = useCallback(async () => {
    await blockUser(deps, userId);
  }, [deps, userId]);

  const unblock = useCallback(async () => {
    await unblockUser(deps, userId);
  }, [deps, userId]);

  return {
    addFriend,
    confirmRequest,
    deleteRequest,
    cancelRequest,
    remove,
    block,
    unblock,
  };
}

export type FriendMutations = ReturnType<typeof useFriendMutations>;

export type FriendActionPillsProps = FriendActionContext & {
  readonly onChanged?: (() => void) | undefined;
};

export type FriendActionPillsComponent = (
  props: FriendActionPillsProps
) => ReactNode;
