import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';

import { removeSpaceUserMutation } from '@libs/spaces-shared/remove-space-user-mutation';

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
