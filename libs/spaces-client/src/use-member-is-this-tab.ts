import { useMyId } from '@libs/auth-client/use-current-user';
import { type Accessor, createMemo } from 'solid-js';

import { useSpacePresence } from './room-use-space-presence';

/**
 * Whether `memberId` is this user *and* this browser tab has an active
 * room connection listed in the live roster.
 */
export function useMemberIsThisTab(
  _spaceId: string,
  memberId: string
): Accessor<boolean> {
  const myId = useMyId();
  const presence = useSpacePresence();
  return createMemo(() => {
    if (myId() !== memberId) return false;
    return presence.selfPeerId !== null;
  });
}
