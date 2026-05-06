import { useMyId } from '@gamezilla/client/auth/auth-context';
import { useMemo } from 'react';

import type { SpaceMemberRow } from './types';
import { useSpacePresence } from './use-space-presence';

export type MemberPresenceFlags = {
  online: boolean;
  sessionCount: number;
  thisTab: boolean;
  isYou: boolean;
};

export function useMemberPresenceFlags(
  members: SpaceMemberRow[]
): Map<string, MemberPresenceFlags> {
  const { peersByMemberId, selfPeerId } = useSpacePresence();
  const myId = useMyId();

  return useMemo(() => {
    const flags = new Map<string, MemberPresenceFlags>();
    for (const m of members) {
      const peerIds = peersByMemberId.get(m.memberId) ?? [];
      const online = peerIds.length > 0;
      const sessionCount = peerIds.length;
      const thisTab =
        selfPeerId !== null &&
        peerIds.includes(selfPeerId) &&
        myId === m.memberId;
      flags.set(m.memberId, {
        online,
        sessionCount,
        thisTab,
        isYou: myId === m.memberId,
      });
    }
    return flags;
  }, [members, peersByMemberId, selfPeerId, myId]);
}

export function defaultMemberFlags(): MemberPresenceFlags {
  return {
    online: false,
    sessionCount: 0,
    thisTab: false,
    isYou: false,
  };
}
