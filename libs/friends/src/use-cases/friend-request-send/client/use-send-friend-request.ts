import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useSyncEngine } from '@pkgs/sync-engine/solid';
import { useCreateId } from '@pkgs/uuid/solid';

import { FRIENDS_NEEDS_CONNECTION } from '../../../shared/friendship/friends-mutation-codes';

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
  const engine = useSyncEngine();
  return async (toUserId: string) => {
    // A request is between two people: offline it is refused here, never
    // queued to arrive later without the asker knowing. A device only learns
    // it lost the server by asking, so ask first (a failed round trip marks
    // the engine offline; it resolves either way).
    await engine.refreshQueries().catch(() => undefined);
    if (!engine.status().online) {
      throw new SendFriendRequestError(
        FRIENDS_NEEDS_CONNECTION,
        'Friend requests need a connection.'
      );
    }
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
