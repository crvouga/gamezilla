import { useSpacePresence } from '@gamezilla/client/spaces/use-space-presence';

/**
 * Whether the given member has any active room connection in this space.
 * Combines patch-db identity with room presence (not a plain attribute).
 */
export function useMemberIsOnline(
  _spaceId: string,
  profileId: string
): boolean {
  const { peersByMemberId } = useSpacePresence();
  return (peersByMemberId.get(profileId) ?? []).length > 0;
}
