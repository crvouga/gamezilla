import { useMemo } from 'react';

import { useMyId } from '@gamezilla/client/auth/auth-context';
import { useSpaceRoomWire } from '../room/space-room-wire-context';

/**
 * Live “who is in this tab” used legacy WebSocket presence. The authoritative
 * room no longer multiplexes presence frames; we approximate “online” as
 * “this account has an active synced room connection for this screen”.
 */
export function useSpacePresence(): {
  peersByMemberId: Map<string, string[]>;
  selfPeerId: string | null;
} {
  const myId = useMyId();
  const { roomActive, roomSynced } = useSpaceRoomWire();

  const peersByMemberId = useMemo(() => {
    const m = new Map<string, string[]>();
    if (myId.length > 0 && roomActive && roomSynced) {
      m.set(myId, ['local']);
    }
    return m;
  }, [myId, roomActive, roomSynced]);

  return {
    peersByMemberId,
    selfPeerId: roomActive && roomSynced ? 'local' : null,
  };
}
