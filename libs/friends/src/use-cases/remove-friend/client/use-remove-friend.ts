import { useMutationClient } from '@libs/auth/public/mutation-client-provider';

import { removeFriendMutation } from '../shared/remove-friend-mutation';

export function useRemoveFriend() {
  const mutationClient = useMutationClient();
  return async (userId: string) => {
    const result = await mutationClient.mutate(removeFriendMutation, {
      userId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
