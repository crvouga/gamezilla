import { declineFriendRequestMutation } from '@libs/friends-shared-ts/decline-friend-request-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';

export function useDeclineFriendRequest() {
  const mutationClient = useMutationClient();
  return async (requestId: string) => {
    const result = await mutationClient.mutate(declineFriendRequestMutation, {
      requestId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
