import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';

import { declineFriendRequestMutation } from '@libs/friends-shared/decline-friend-request-mutation';

export function useDeclineFriendRequest() {
  const mutationClient = useMutationClient();
  return async (requestId: string) => {
    const result = await mutationClient.mutate(declineFriendRequestMutation, {
      requestId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
