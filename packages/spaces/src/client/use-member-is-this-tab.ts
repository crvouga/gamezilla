import { useMyId } from '@gamezilla/client-runtime/identity-context';
import { useSpacePresence } from './use-space-presence';

/**
 * Whether `profileId` corresponds to the current user *and* the active room
 * connection is this browser tab (not just another tab logged into the same
 * account).
 */
export function useMemberIsThisTab(
  _spaceId: string,
  profileId: string
): boolean {
  const myId = useMyId();
  const { peersByMemberId, selfPeerId } = useSpacePresence();
  if (myId !== profileId) return false;
  if (selfPeerId === null) return false;
  return (peersByMemberId.get(profileId) ?? []).includes(selfPeerId);
}
