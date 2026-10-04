import { blockUserMutation } from '@libs/friends-shared/block-user-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client/solid';

export function useBlockUser() {
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  return async (userId: string) => {
    const result = await mutationClient.mutate(blockUserMutation, {
      blockId: createId(),
      userId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
