import { type Accessor, createMemo } from 'solid-js';

import { useSpacePresence } from './room-use-space-presence';

/**
 * Whether the given member has any active room connection in this space.
 * Combines sync identity with room presence (not a plain attribute).
 */
export function useMemberIsOnline(
  _spaceId: string,
  profileId: string
): Accessor<boolean> {
  const presence = useSpacePresence();
  return createMemo(
    () => (presence.peersByMemberId().get(profileId) ?? []).length > 0
  );
}
