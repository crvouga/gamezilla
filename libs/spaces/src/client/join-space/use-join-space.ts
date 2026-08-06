import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCallback } from 'react';

import { joinSpaceMutation } from '../../shared/mutations/space-mutations';

export function useJoinSpace() {
  const mutationClient = useMutationClient();

  return useCallback(
    async (spaceId: string) => {
      const result = await mutationClient.mutate(joinSpaceMutation, {
        spaceId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
