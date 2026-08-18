import { SpaceField, useSpaceColumn } from '../../../public/use-space-column';
import { resolvePresenceRole } from '../../../shared/space/participation/space-participation-policy';

export function useMemberRole(
  spaceId: string,
  profileId: string
): 'host' | 'guest' | null {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  if (hostMemberId === null || hostMemberId.length === 0) return null;
  return resolvePresenceRole({ hostMemberId, memberId: profileId });
}
