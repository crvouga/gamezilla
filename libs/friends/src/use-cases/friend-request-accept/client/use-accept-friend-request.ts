import { useMutationClient } from '@libs/auth/public/use-mutation-client';

import { acceptFriendRequestMutation } from '../shared/accept-friend-request-mutation';

export function useAcceptFriendRequest() {
  const mutationClient = useMutationClient();
  return async (requestId: string) => {
    const result = await mutationClient.mutate(acceptFriendRequestMutation, {
      requestId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
