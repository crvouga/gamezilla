import { useMyId } from '@libs/auth-client/use-current-user';
import { type Accessor, createMemo } from 'solid-js';

import { useSpaceRoomClientId } from './space-room-context';
import { useConnectedSpaceRoster } from './use-connected-space-roster';

/**
 * Live connected-client roster from the authoritative room.
 * Multiple clients for the same member appear as multiple peer ids.
 */
export function useSpacePresence(): {
  readonly peersByMemberId: Accessor<Map<string, string[]>>;
  readonly selfPeerId: Accessor<string | null>;
  readonly selfClientId: Accessor<string | null>;
} {
  const memberId = useMyId();
  const selfClientId = useSpaceRoomClientId();
  const roster = useConnectedSpaceRoster();

  const peersByMemberId = createMemo(() => {
    const peers = new Map<string, string[]>();
    for (const client of roster()) {
      const existing = peers.get(client.id);
      if (existing === undefined) {
        peers.set(client.id, [client.clientId]);
      } else {
        existing.push(client.clientId);
      }
    }
    return peers;
  });
  const selfInRoster = createMemo(() => {
    const client = selfClientId();
    if (client === null) return false;
    return roster().some((c) => c.id === memberId() && c.clientId === client);
  });

  return {
    peersByMemberId,
    selfPeerId: createMemo(() => (selfInRoster() ? selfClientId() : null)),
    selfClientId: createMemo(() => (selfInRoster() ? selfClientId() : null)),
  };
}
