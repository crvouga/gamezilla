import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCallback } from 'react';

import { declineFriendRequestMutation } from '../../shared/mutations/friends-mutations';

export function useDeclineFriendRequest() {
  const mutationClient = useMutationClient();
  return useCallback(
    async (requestId: string) => {
      const result = await mutationClient.mutate(declineFriendRequestMutation, {
        requestId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
