import { sendFriendRequestMutation } from '@libs/friends-shared/send-friend-request-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client/solid';

/** A refused request, with the server's reason code (e.g. `FRIENDS_COOLDOWN`). */
export class SendFriendRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SendFriendRequestError';
    this.code = code;
  }
}

export function useSendFriendRequest() {
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  return async (toUserId: string) => {
    const result = await mutationClient.mutate(sendFriendRequestMutation, {
      requestId: createId(),
      toUserId,
    });
    if (result.ok) return;
    const failure = result.failures[0];
    throw new SendFriendRequestError(
      failure?.code ?? 'UNKNOWN',
      failure?.message ?? "Couldn't send"
    );
  };
}
