import { type Accessor, createMemo } from 'solid-js';

import { SpaceField, useSpaceColumn } from '../../../public/use-space-column';
import { resolvePresenceRole } from '../../../shared/space/participation/space-participation-policy';

export function useMemberRole(
  spaceId: string,
  profileId: string
): Accessor<'host' | 'guest' | null> {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  return createMemo(() => {
    const host = hostMemberId();
    if (host === null || host.length === 0) return null;
    return resolvePresenceRole({ hostMemberId: host, memberId: profileId });
  });
}
