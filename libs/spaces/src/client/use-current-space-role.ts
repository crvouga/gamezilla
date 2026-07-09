import {
  useCurrentSpaceIds,
  isReplicationHost,
  useReplicationIdentityIds,
} from './use-current-space-ids';
import { useSpaceColumn, SpaceField } from './use-space-column';

/**
 * Returns the current user's role on `spaceId` — `'host'`, `'guest'`, or
 * `null` when they aren't in the space.
 */
export function useCurrentSpaceRole(spaceId: string): 'host' | 'guest' | null {
  const identityIds = useReplicationIdentityIds();
  const { entries } = useCurrentSpaceIds();
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);

  const entry = entries.find((e) => e.spaceId === spaceId);
  if (entry !== undefined) return entry.role;
  if (endedAt === null && isReplicationHost(hostId, identityIds)) {
    return 'host';
  }
  return null;
}
