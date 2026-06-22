import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { useQueryAttribute } from '@pkgs/patch-db/react';

import { useCurrentSpaceIds } from './use-current-space-ids';
import {
  isReplicationHost,
  useReplicationIdentityIds,
} from './use-replication-identity-ids';

/**
 * Returns the current user's role on `spaceId` — `'host'`, `'guest'`, or
 * `null` when they aren't in the space.
 */
export function useCurrentSpaceRole(spaceId: string): 'host' | 'guest' | null {
  const identityIds = useReplicationIdentityIds();
  const { entries } = useCurrentSpaceIds();
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.hostId,
  });
  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.endedAt,
  });

  const entry = entries.find((e) => e.spaceId === spaceId);
  if (entry !== undefined) return entry.role;
  if (endedAt === null && isReplicationHost(hostId, identityIds)) {
    return 'host';
  }
  return null;
}
