import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCallback } from 'react';

import {
  addSpaceUserMutation,
  removeSpaceUserMutation,
} from '../../shared/mutations/space-mutations';

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

export function useRemoveSpaceUser() {
  const mutationClient = useMutationClient();
  return useCallback(
    async (spaceId: string, userId: string) => {
      const result = await mutationClient.mutate(removeSpaceUserMutation, {
        spaceId,
        userId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [mutationClient]
  );
}
