import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryEntityIds } from '@gamezilla/patch-db/react';

/**
 * Ids of every live (non-ended) space, ordered newest-first.
 *
 * Used by `<SpacesList>` and the debug modal. Atoms render their own
 * data from each id via `<SpaceCard spaceId />`.
 */
export function useLiveSpaceIds(): string[] {
  return useQueryEntityIds({
    entityType: SPACE_ENTITY_TYPE,
    where: { type: 'not_exists', attribute: SpaceAttr.endedAt },
    orderBy: [{ attribute: SpaceAttr.createdAt, direction: 'desc' }],
  });
}
