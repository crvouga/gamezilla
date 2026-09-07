import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useCreateId } from '@pkgs/uuid/solid';

import { blockUserMutation } from '../shared/block-user-mutation';

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
