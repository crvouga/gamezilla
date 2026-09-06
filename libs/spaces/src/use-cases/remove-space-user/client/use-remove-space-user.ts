import { useMutationClient } from '@libs/auth/public/mutation-client-provider';

import { removeSpaceUserMutation } from '../shared/remove-space-user-mutation';

export function useRemoveSpaceUser() {
  const mutationClient = useMutationClient();
  return async (spaceId: string, userId: string) => {
    const result = await mutationClient.mutate(removeSpaceUserMutation, {
      spaceId,
      userId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
