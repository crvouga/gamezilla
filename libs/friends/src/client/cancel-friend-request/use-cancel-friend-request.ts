import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCallback } from 'react';

import { cancelFriendRequestMutation } from '../../shared/mutations/friends-mutations';

export function useCancelFriendRequest() {
  const mutationClient = useMutationClient();
  return useCallback(
    async (requestId: string) => {
      const result = await mutationClient.mutate(cancelFriendRequestMutation, {
        requestId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
