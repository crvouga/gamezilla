import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useCreateId } from '@pkgs/uuid/solid';

import { sendFriendRequestMutation } from '../shared/send-friend-request-mutation';

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
