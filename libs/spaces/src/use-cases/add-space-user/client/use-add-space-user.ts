import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useCallback } from 'react';

import { addSpaceUserMutation } from '../shared/add-space-user-mutation';

export function useAddSpaceUser() {
  const mutationClient = useMutationClient();
  return useCallback(
    async (spaceId: string, userId: string) => {
      const result = await mutationClient.mutate(addSpaceUserMutation, {
        spaceId,
        userId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
