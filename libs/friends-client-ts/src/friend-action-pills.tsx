import type {
  FriendActionMutations,
  FriendActionPillsProps,
} from '@libs/friends-shared-ts/friend-action-types';
import type { JSX } from 'solid-js';
import { createSignal } from 'solid-js';
import { FriendActionPillsForStatus } from './friend-action-pills-by-status';
import { useAcceptFriendRequest } from './use-accept-friend-request';
import { useCancelFriendRequest } from './use-cancel-friend-request';
import { useDeclineFriendRequest } from './use-decline-friend-request';
import {
  SendFriendRequestError,
  useSendFriendRequest,
} from './use-send-friend-request';
import { useUnblockUser } from './use-unblock-user';

export function FriendActionPills(props: FriendActionPillsProps): JSX.Element {
  const sendFriendRequest = useSendFriendRequest();
  const acceptFriendRequest = useAcceptFriendRequest();
  const declineFriendRequest = useDeclineFriendRequest();
  const cancelFriendRequest = useCancelFriendRequest();
  const unblockUser = useUnblockUser();

  // Why the last Add was refused, so the pill can say so (not just "Couldn't").
  const [addFailureCode, setAddFailureCode] = createSignal<string | null>(null);

  const addFriend = async () => {
    setAddFailureCode(null);
    try {
      await sendFriendRequest(props.userId);
    } catch (error) {
      if (error instanceof SendFriendRequestError) {
        setAddFailureCode(error.code);
      }
      throw error;
    }
  };
  const confirmRequest = async () => {
    const requestId = props.incomingRequestId;
    if (requestId === null) return;
    await acceptFriendRequest(requestId);
  };
  const deleteRequest = async () => {
    const requestId = props.incomingRequestId;
    if (requestId === null) return;
    await declineFriendRequest(requestId);
  };
  const cancelRequest = async () => {
    const requestId = props.outgoingRequestId;
    if (requestId === null) return;
    await cancelFriendRequest(requestId);
  };
  const unblock = async () => {
    await unblockUser(props.userId);
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
      status={props.status}
      mutations={mutations}
      addFailureCode={addFailureCode}
      onChanged={props.onChanged}
      {...(props.username !== undefined ? { username: props.username } : {})}
    />
  );
}
