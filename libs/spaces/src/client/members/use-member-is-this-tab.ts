import { useMyId } from '@libs/auth/client/use-current-user';
import { useSpacePresence } from '../room/use-space-presence';

/**
 * Whether `memberId` is this user *and* the active room connection is this
 * browser tab.
 */
export function useMemberIsThisTab(
  _spaceId: string,
  memberId: string
): boolean {
  const myId = useMyId();
  const { peersByMemberId, selfPeerId } = useSpacePresence();
  if (myId !== memberId) return false;
  if (selfPeerId === null) return false;
  return (peersByMemberId.get(memberId) ?? []).includes(selfPeerId);
}
