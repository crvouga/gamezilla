import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useCallback } from 'react';

import { removeFriendMutation } from '../shared/remove-friend-mutation';

export function useRemoveFriend() {
  const mutationClient = useMutationClient();
  return useCallback(
    async (userId: string) => {
      const result = await mutationClient.mutate(removeFriendMutation, {
        userId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
