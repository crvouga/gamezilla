import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { leaveSpaceMutation } from '../../mutations';

export function useLeaveSpace() {
  const mutationClient = useMutationClient();
  return async (spaceId: string) => {
    const result = await mutationClient.mutate(leaveSpaceMutation, { spaceId });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
