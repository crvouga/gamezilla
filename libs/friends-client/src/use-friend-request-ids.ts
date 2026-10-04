import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';

import {
  useIncomingFriendRequests,
  useOutgoingFriendRequests,
} from './use-friend-requests';

export function useFriendRequestIdsForUser(targetUserId: Accessor<string>): {
  readonly incomingRequestId: Accessor<string | null>;
  readonly outgoingRequestId: Accessor<string | null>;
} {
  const { requests: incoming } = useIncomingFriendRequests();
  const { requests: outgoing } = useOutgoingFriendRequests();

  const ids = createMemo(() => {
    const target = targetUserId();
    if (target.length === 0) {
      return { incomingRequestId: null, outgoingRequestId: null };
    }
    const incomingMatch = incoming().find((r) => r.fromUserId === target);
    const outgoingMatch = outgoing().find((r) => r.toUserId === target);
    return {
      incomingRequestId: incomingMatch?.id ?? null,
      outgoingRequestId: outgoingMatch?.id ?? null,
    };
  });

  const incomingRequestId = createMemo(() => ids().incomingRequestId);
  const outgoingRequestId = createMemo(() => ids().outgoingRequestId);

  return {
    incomingRequestId,
    outgoingRequestId,
  };
}
