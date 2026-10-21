import { unblockUserMutation } from '@libs/friends-shared-ts/unblock-user-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';

export function useUnblockUser() {
  const mutationClient = useMutationClient();
  return async (userId: string) => {
    const result = await mutationClient.mutate(unblockUserMutation, {
      userId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
