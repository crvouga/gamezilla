import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { type Accessor, createMemo } from 'solid-js';
import { SpaceField, useSpaceColumn } from './use-space-column';
import { useSpaceRoomSelector } from './use-space-room-selector';

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
