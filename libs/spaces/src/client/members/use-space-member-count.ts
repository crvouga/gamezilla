import { SpaceField, useSpaceColumn } from '../use-space-column';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export function useSpaceMemberCount(spaceId: string): number {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const guests = useSpaceGuestMembershipIds(spaceId);
  return (
    (hostMemberId !== null && hostMemberId.length > 0 ? 1 : 0) + guests.length
  );
}
