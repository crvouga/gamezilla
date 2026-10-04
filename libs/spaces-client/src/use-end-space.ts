import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { endSpaceMutation } from '@libs/spaces-shared/end-space-mutation';

export function useEndSpace() {
  const mutationClient = useMutationClient();
  return async (spaceId: string) => {
    const result = await mutationClient.mutate(endSpaceMutation, { spaceId });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
