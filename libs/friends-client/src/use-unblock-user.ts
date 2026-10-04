import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';

import { unblockUserMutation } from '@libs/friends-shared/unblock-user-mutation';

export function useUnblockUser() {
  const mutationClient = useMutationClient();
  return async (userId: string) => {
    const result = await mutationClient.mutate(unblockUserMutation, {
      userId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
