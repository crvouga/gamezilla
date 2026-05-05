import { PROFILE_ENTITY_TYPE } from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

/** Loads `profile` rows keyed by `entityId` (each id is a “my id” for some actor). */
export function useProfileEntities(profileEntityIds: string[]): {
  profileById: Map<string, Entity>;
} {
  const sortedUniqueIds = useMemo(
    () => [...new Set(profileEntityIds)].filter((id) => id.length > 0).sort(),
    [profileEntityIds]
  );

  const profilesResult = useQuery(
    sortedUniqueIds.length === 0
      ? { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
      : { entityType: PROFILE_ENTITY_TYPE, entityId: sortedUniqueIds }
  );

  const profileById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const p of profilesResult.entities) {
      m.set(p.entityId, p);
    }
    return m;
  }, [profilesResult.entities]);

  return { profileById };
}
