import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';

import { removeFriendMutation } from '@libs/friends-shared/remove-friend-mutation';

export function useRemoveFriend() {
  const mutationClient = useMutationClient();
  return async (userId: string) => {
    const result = await mutationClient.mutate(removeFriendMutation, {
      userId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
