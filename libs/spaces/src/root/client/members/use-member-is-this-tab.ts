import { useMyId } from '@libs/auth/public/use-current-user';

import { useSpacePresence } from '../../../public/room/use-space-presence';

/**
 * Whether `memberId` is this user *and* this browser tab has an active
 * room connection listed in the live roster.
 */
export function useMemberIsThisTab(
  _spaceId: string,
  memberId: string
): boolean {
  const myId = useMyId();
  const { selfPeerId } = useSpacePresence();
  if (myId !== memberId) return false;
  return selfPeerId !== null;
}
