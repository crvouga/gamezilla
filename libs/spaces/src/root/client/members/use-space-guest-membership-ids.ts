import { useMemo } from 'react';
import { useSpaceRoomSelector } from '../../../public/room/use-space-room-selector';
import { SpaceField, useSpaceColumn } from '../../../public/use-space-column';
import { SpaceMembersRoomAttr } from '../../../shared/space/space-members/space-members-messages';

/**
 * Guest member ids currently seated in the room (excludes the host).
 * Empty when the space room is not connected — ACL is not presence.
 */
export function useSpaceGuestMembershipIds(spaceId: string): string[] {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const seats = useSpaceRoomSelector(SpaceMembersRoomAttr.seats.from);
  return useMemo(() => {
    if (spaceId.length === 0) return [];
    return Object.keys(seats)
      .filter((id) => id !== hostMemberId)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [spaceId, seats, hostMemberId]);
}
