import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCallback } from 'react';

import { unblockUserMutation } from '../../shared/mutations/friends-mutations';

export function useUnblockUser() {
  const mutationClient = useMutationClient();
  return useCallback(
    async (userId: string) => {
      const result = await mutationClient.mutate(unblockUserMutation, {
        userId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
