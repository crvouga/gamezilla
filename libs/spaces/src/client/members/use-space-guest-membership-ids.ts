import { useMemo } from 'react';

import { SpaceMembersRoomAttr } from '../../shared/space-members/space-members-messages';
import { useSpaceRoomSelector } from '../room/use-space-room-selector';
import { SpaceField, useSpaceColumn } from '../use-space-column';

/**
 * Guest member ids currently seated in the room (excludes the host).
 * Empty when the space room is not connected — ACL is not presence.
 */
export function useSpaceGuestMembershipIds(spaceId: string): string[] {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const seats = useSpaceRoomSelector(SpaceMembersRoomAttr.seats.from);
  return useMemo(() => {
    if (spaceId.length === 0) return [];
    return Object.keys(seats).filter((id) => id !== hostMemberId);
  }, [spaceId, seats, hostMemberId]);
}
