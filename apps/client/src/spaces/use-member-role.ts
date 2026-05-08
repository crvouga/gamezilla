import { parseStringAttr } from '@gamezilla/client/spaces/space-parsers';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';

/**
 * `'host'` when `profileId` matches the space's host, `'guest'` otherwise.
 * Returns `null` while the host id has not been resolved (row not synced).
 *
 * Reads `space/hostId` inline; no per-attribute hook needed.
 */
export function useMemberRole(
  spaceId: string,
  profileId: string
): 'host' | 'guest' | null {
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.hostId,
    attributeValue: parseStringAttr,
  });
  if (hostId === null) return null;
  return hostId === profileId ? 'host' : 'guest';
}
