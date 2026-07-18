import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { useSpaceColumn, SpaceField } from '../use-space-column';

export function useSpaceMemberCount(spaceId: string): number {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const guests = useSpaceGuestMembershipIds(spaceId);
  return (hostMemberId !== null && hostMemberId.length > 0 ? 1 : 0) + guests.length;
}
