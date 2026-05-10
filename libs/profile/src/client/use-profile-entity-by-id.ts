import { PROFILE_ENTITY_TYPE } from '../shared/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';

/**
 * Reads a single profile entity by id. Used by editors that need to seed
 * draft state from the persisted row (avatar editor, display-name editor).
 *
 * Returns `null` while the id is empty or the row hasn't materialized.
 */
export function useProfileEntityById(profileId: string | null): Entity | null {
  const enabled = profileId !== null && profileId.length > 0;
  const res = useQuery(
    enabled
      ? { entityType: PROFILE_ENTITY_TYPE, entityId: profileId }
      : { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
  );
  return res.entities[0] ?? null;
}
