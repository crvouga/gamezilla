import { type Accessor, createMemo } from 'solid-js';
import { useSpaceRoomSelector } from '../../../public/room/use-space-room-selector';
import { SpaceField, useSpaceColumn } from '../../../public/use-space-column';
import { SpaceMembersRoomAttr } from '../../../shared/space/space-members/space-members-messages';

/**
 * Guest member ids currently seated in the room (excludes the host).
 * Empty when the space room is not connected — ACL is not presence.
 */
export function useSpaceGuestMembershipIds(
  spaceId: string
): Accessor<readonly string[]> {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const seats = useSpaceRoomSelector(SpaceMembersRoomAttr.seats.from);
  return createMemo(() => {
    if (spaceId.length === 0) return [];
    const host = hostMemberId();
    return Object.keys(seats())
      .filter((id) => id !== host)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  });
}
