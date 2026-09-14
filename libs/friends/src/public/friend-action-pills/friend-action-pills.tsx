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

export function FriendActionPills(props: FriendActionPillsProps): JSX.Element {
  const sendFriendRequest = useSendFriendRequest();
  const acceptFriendRequest = useAcceptFriendRequest();
  const declineFriendRequest = useDeclineFriendRequest();
  const cancelFriendRequest = useCancelFriendRequest();
  const unblockUser = useUnblockUser();

  const addFriend = async () => {
    await sendFriendRequest(props.userId);
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
      onChanged={props.onChanged}
      {...(props.username !== undefined ? { username: props.username } : {})}
    />
  );
}
