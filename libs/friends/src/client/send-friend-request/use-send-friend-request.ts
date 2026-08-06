import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCallback } from 'react';

import { sendFriendRequestMutation } from '../../shared/mutations/friends-mutations';

export function useSendFriendRequest() {
  const mutationClient = useMutationClient();
  return useCallback(
    async (toUserId: string) => {
      const result = await mutationClient.mutate(sendFriendRequestMutation, {
        requestId: crypto.randomUUID(),
        toUserId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
