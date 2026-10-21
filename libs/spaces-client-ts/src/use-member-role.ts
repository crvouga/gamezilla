import { resolvePresenceRole } from '@libs/spaces-shared-ts/space-participation-policy';
import { type Accessor, createMemo } from 'solid-js';
import { SpaceField, useSpaceColumn } from './use-space-column';

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
