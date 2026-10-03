import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { endSpaceMutation } from '../../mutations';

export function useEndSpace() {
  const mutationClient = useMutationClient();
  return async (spaceId: string) => {
    const result = await mutationClient.mutate(endSpaceMutation, { spaceId });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
