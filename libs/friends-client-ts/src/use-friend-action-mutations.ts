import type { FriendActionMutations } from '@libs/friends-shared-ts/friend-action-types';
import type { Accessor } from 'solid-js';
import { createSignal } from 'solid-js';
import { useAcceptFriendRequest } from './use-accept-friend-request';
import { useCancelFriendRequest } from './use-cancel-friend-request';
import { useDeclineFriendRequest } from './use-decline-friend-request';
import {
  SendFriendRequestError,
  useSendFriendRequest,
} from './use-send-friend-request';
import { useUnblockUser } from './use-unblock-user';

/**
 * The friend action pills' mutations, bound to one person and their pending
 * request ids, plus why the last Add was refused (so the pill can say so,
 * not just "Couldn't").
 */
export function useFriendActionMutations(input: {
  readonly userId: Accessor<string>;
  readonly incomingRequestId: Accessor<string | null>;
  readonly outgoingRequestId: Accessor<string | null>;
}): {
  readonly mutations: FriendActionMutations;
  readonly addFailureCode: Accessor<string | null>;
} {
  const sendFriendRequest = useSendFriendRequest();
  const acceptFriendRequest = useAcceptFriendRequest();
  const declineFriendRequest = useDeclineFriendRequest();
  const cancelFriendRequest = useCancelFriendRequest();
  const unblockUser = useUnblockUser();
  const [addFailureCode, setAddFailureCode] = createSignal<string | null>(null);

  const addFriend = async () => {
    setAddFailureCode(null);
    try {
      await sendFriendRequest(input.userId());
    } catch (error) {
      if (error instanceof SendFriendRequestError) {
        setAddFailureCode(error.code);
      }
      throw error;
    }
  };
  const confirmRequest = async () => {
    const requestId = input.incomingRequestId();
    if (requestId === null) return;
    await acceptFriendRequest(requestId);
  };
  const deleteRequest = async () => {
    const requestId = input.incomingRequestId();
    if (requestId === null) return;
    await declineFriendRequest(requestId);
  };
  const cancelRequest = async () => {
    const requestId = input.outgoingRequestId();
    if (requestId === null) return;
    await cancelFriendRequest(requestId);
  };
  const unblock = async () => {
    await unblockUser(input.userId());
  };

  return {
    mutations: {
      addFriend,
      confirmRequest,
      deleteRequest,
      cancelRequest,
      unblock,
    },
    addFailureCode,
  };
}
