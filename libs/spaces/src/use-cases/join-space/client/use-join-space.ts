import { useMutationClient } from '@libs/auth/public/mutation-client-provider';

import { joinSpaceMutation } from '../shared/join-space-mutation';

export function useJoinSpace() {
  const mutationClient = useMutationClient();

  return async (spaceId: string) => {
    const result = await mutationClient.mutate(joinSpaceMutation, {
      spaceId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
