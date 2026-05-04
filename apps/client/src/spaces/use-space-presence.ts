import { useMemo } from 'react';

import { useSelfAuthIdentity } from './device-display-resolution';
import { useSpaceRoomWire } from './space-room-wire-context';

/**
 * Live “who is in this tab” used legacy WebSocket presence. The authoritative
 * room no longer multiplexes presence frames; we approximate “online” as
 * “this account has an active synced room connection for this screen”.
 */
export function useSpacePresence(): {
  peersByAccountId: Map<string, string[]>;
  selfPeerId: string | null;
} {
  const { selfAccountId } = useSelfAuthIdentity();
  const { roomActive, roomSynced } = useSpaceRoomWire();

  const peersByAccountId = useMemo(() => {
    const m = new Map<string, string[]>();
    if (
      selfAccountId !== null &&
      selfAccountId.length > 0 &&
      roomActive &&
      roomSynced
    ) {
      m.set(selfAccountId, ['local']);
    }
    return m;
  }, [selfAccountId, roomActive, roomSynced]);

  return {
    peersByAccountId,
    selfPeerId: roomActive && roomSynced ? 'local' : null,
  };
}
