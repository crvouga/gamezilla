import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';

import { addSpaceUserMutation } from '@libs/spaces-shared/add-space-user-mutation';

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
