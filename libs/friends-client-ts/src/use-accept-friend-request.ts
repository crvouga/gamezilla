import { acceptFriendRequestMutation } from '@libs/friends-shared-ts/accept-friend-request-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';

export function useAcceptFriendRequest() {
  const mutationClient = useMutationClient();
  return async (requestId: string) => {
    const result = await mutationClient.mutate(acceptFriendRequestMutation, {
      requestId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
