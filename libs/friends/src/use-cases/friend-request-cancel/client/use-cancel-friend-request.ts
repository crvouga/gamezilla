import { useMutationClient } from '@libs/auth/public/use-mutation-client';

import { cancelFriendRequestMutation } from '../shared/cancel-friend-request-mutation';

export function useCancelFriendRequest() {
  const mutationClient = useMutationClient();
  return async (requestId: string) => {
    const result = await mutationClient.mutate(cancelFriendRequestMutation, {
      requestId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
