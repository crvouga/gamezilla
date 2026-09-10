import { useMutationClient } from '@libs/auth/public/use-mutation-client';

import { addSpaceUserMutation } from '../shared/add-space-user-mutation';

export function useAddSpaceUser() {
  const mutationClient = useMutationClient();
  return async (spaceId: string, userId: string) => {
    const result = await mutationClient.mutate(addSpaceUserMutation, {
      spaceId,
      userId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
