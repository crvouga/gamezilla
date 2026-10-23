import { addSpaceUserMutation } from '@libs/spaces-shared-ts/add-space-user-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';

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
