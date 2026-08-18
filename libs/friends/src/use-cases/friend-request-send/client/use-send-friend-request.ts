import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useCreateId } from '@pkgs/uuid';
import { useCallback } from 'react';

import { sendFriendRequestMutation } from '../shared/send-friend-request-mutation';

export function useSendFriendRequest() {
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  return useCallback(
    async (toUserId: string) => {
      const result = await mutationClient.mutate(sendFriendRequestMutation, {
        requestId: createId(),
        toUserId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient, createId]
  );
}
