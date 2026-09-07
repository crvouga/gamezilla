import { type Accessor, createMemo } from 'solid-js';

import { useSpacePresence } from '../../../public/room/use-space-presence';

/**
 * Number of active room connections (peer ids) for this member in this space.
 */
export function useMemberSessionCount(
  _spaceId: string,
  profileId: string
): Accessor<number> {
  const presence = useSpacePresence();
  return createMemo(
    () => (presence.peersByMemberId().get(profileId) ?? []).length
  );
}
