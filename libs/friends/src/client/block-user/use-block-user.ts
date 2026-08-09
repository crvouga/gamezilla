import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCreateId } from '@pkgs/uuid';
import { useCallback } from 'react';

import { blockUserMutation } from '../../shared/mutations/friends-mutations';

export function useBlockUser() {
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  return useCallback(
    async (userId: string) => {
      const result = await mutationClient.mutate(blockUserMutation, {
        blockId: createId(),
        userId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient, createId]
  );
}
