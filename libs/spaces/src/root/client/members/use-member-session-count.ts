import { useSpacePresence } from '../../../public/room/use-space-presence';

/**
 * Number of active room connections (peer ids) for this member in this space.
 */
export function useMemberSessionCount(
  _spaceId: string,
  profileId: string
): number {
  const { peersByMemberId } = useSpacePresence();
  return (peersByMemberId.get(profileId) ?? []).length;
}
