import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { useSpaceColumn, SpaceField } from '../use-space-column';

export function useSpaceMemberCount(spaceId: string): number {
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const guests = useSpaceGuestMembershipIds(spaceId);
  return (hostId !== null ? 1 : 0) + guests.length;
}
