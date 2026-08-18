import { useMemo } from 'react';

import {
  useIncomingFriendRequests,
  useOutgoingFriendRequests,
} from '../use-cases/list-friend-requests/client/use-friend-requests';

export function useFriendRequestIdsForUser(targetUserId: string): {
  readonly incomingRequestId: string | null;
  readonly outgoingRequestId: string | null;
} {
  const { requests: incoming } = useIncomingFriendRequests();
  const { requests: outgoing } = useOutgoingFriendRequests();

  return useMemo(() => {
    if (targetUserId.length === 0) {
      return { incomingRequestId: null, outgoingRequestId: null };
    }
    const incomingMatch = incoming.find((r) => r.fromUserId === targetUserId);
    const outgoingMatch = outgoing.find((r) => r.toUserId === targetUserId);
    return {
      incomingRequestId: incomingMatch?.id ?? null,
      outgoingRequestId: outgoingMatch?.id ?? null,
    };
  }, [incoming, outgoing, targetUserId]);
}
