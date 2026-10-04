import { leaveSpaceMutation } from '@libs/spaces-shared/leave-space-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';

export function useLeaveSpace() {
  const mutationClient = useMutationClient();
  return async (spaceId: string) => {
    const result = await mutationClient.mutate(leaveSpaceMutation, { spaceId });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
