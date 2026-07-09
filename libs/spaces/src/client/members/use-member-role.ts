import { useSpaceColumn, SpaceField } from '../use-space-column';

export function useMemberRole(
  spaceId: string,
  profileId: string
): 'host' | 'guest' | null {
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  if (hostId === null) return null;
  return hostId === profileId ? 'host' : 'guest';
}
