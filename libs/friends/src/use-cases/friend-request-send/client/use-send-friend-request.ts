import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useCreateId } from '@pkgs/uuid/solid';

import { sendFriendRequestMutation } from '../shared/send-friend-request-mutation';

export function useSendFriendRequest() {
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  return async (toUserId: string) => {
    const result = await mutationClient.mutate(sendFriendRequestMutation, {
      requestId: createId(),
      toUserId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
