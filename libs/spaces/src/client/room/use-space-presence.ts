import { useMyId } from '@libs/auth/client/use-current-user';
import { RoomMetaAttr, useRoomFromRegistry, useRoomRoster } from '@pkgs/room';
import { useMemo } from 'react';

import { useSpaceRoomClientId } from './space-room-context';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from './use-space-room-selector';

/**
 * Live connected-client roster from the authoritative room.
 * Multiple clients for the same member appear as multiple peer ids.
 */
export function useSpacePresence(): {
  peersByMemberId: Map<string, string[]>;
  selfPeerId: string | null;
  selfClientId: string | null;
} {
  const memberId = useMyId();
  const selfClientId = useSpaceRoomClientId();
  const room = useRoomFromRegistry(SPACE_ROOM_NAME);
  const roster = useRoomRoster(room);
  const roomSynced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);

  return useMemo(() => {
    const peersByMemberId = new Map<string, string[]>();
    if (!roomSynced) {
      return {
        peersByMemberId,
        selfPeerId: null,
        selfClientId: null,
      };
    }
    for (const client of roster) {
      const existing = peersByMemberId.get(client.id);
      if (existing === undefined) {
        peersByMemberId.set(client.id, [client.clientId]);
      } else {
        existing.push(client.clientId);
      }
    }
    const selfInRoster =
      selfClientId !== null &&
      roster.some((c) => c.id === memberId && c.clientId === selfClientId);
    return {
      peersByMemberId,
      selfPeerId: selfInRoster ? selfClientId : null,
      selfClientId: selfInRoster ? selfClientId : null,
    };
  }, [roster, roomSynced, memberId, selfClientId]);
}
