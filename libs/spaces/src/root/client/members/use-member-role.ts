import { resolvePresenceRole } from '../../shared/participation/space-participation-policy';
import { SpaceField, useSpaceColumn } from '../use-space-column';

export function useMemberRole(
  spaceId: string,
  profileId: string
): 'host' | 'guest' | null {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  if (hostMemberId === null || hostMemberId.length === 0) return null;
  return resolvePresenceRole({ hostMemberId, memberId: profileId });
}
