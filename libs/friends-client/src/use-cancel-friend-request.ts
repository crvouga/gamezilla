import { cancelFriendRequestMutation } from '@libs/friends-shared/cancel-friend-request-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';

export function useCancelFriendRequest() {
  const mutationClient = useMutationClient();
  return async (requestId: string) => {
    const result = await mutationClient.mutate(cancelFriendRequestMutation, {
      requestId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
