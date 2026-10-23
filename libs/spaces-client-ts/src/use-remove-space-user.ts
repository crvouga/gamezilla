import { removeSpaceUserMutation } from '@libs/spaces-shared-ts/remove-space-user-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';

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
