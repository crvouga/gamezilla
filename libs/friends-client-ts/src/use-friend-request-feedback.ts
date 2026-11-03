import { sendFriendRequestMutation } from '@libs/friends-shared-ts/send-friend-request-mutation';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import type { FriendRequestOutcome } from './friend-request-feedback-view';

/**
 * The last friend request to this person, kept beside their profile across
 * app reopening: still being shared while it is outstanding, or refused.
 */
export function useFriendRequestFeedback(input: {
  readonly userId: Accessor<string>;
  readonly outgoingRequestId: Accessor<string | null>;
}): Accessor<FriendRequestOutcome | null> {
  const engine = useSyncEngine();
  const feedback = useMutationFeedback(sendFriendRequestMutation.name, () => ({
    toUserId: input.userId(),
  }));
  return createMemo((): FriendRequestOutcome | null => {
    const current = feedback();
    if (current?.status === 'pending' && input.outgoingRequestId() !== null) {
      return { status: 'pending', online: engine.status().online };
    }
    if (current?.status === 'rejected') {
      return { status: 'rejected', code: current.code ?? '' };
    }
    return null;
  });
}
