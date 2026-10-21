import { blockUserMutation } from '@libs/friends-shared-ts/block-user-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';

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
