import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';

import { joinSpaceMutation } from '@libs/spaces-shared/join-space-mutation';

export function useJoinSpace() {
  const mutationClient = useMutationClient();

  return async (spaceId: string) => {
    const result = await mutationClient.mutate(joinSpaceMutation, {
      spaceId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
