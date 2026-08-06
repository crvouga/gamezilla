import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCallback } from 'react';

import { blockUserMutation } from '../../shared/mutations/friends-mutations';

export function useBlockUser() {
  const mutationClient = useMutationClient();
  return useCallback(
    async (userId: string) => {
      const result = await mutationClient.mutate(blockUserMutation, {
        blockId: crypto.randomUUID(),
        userId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
