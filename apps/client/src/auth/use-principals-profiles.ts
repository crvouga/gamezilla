import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { resolveAvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

export type PrincipalProfileSummary = {
  displayName: string | null;
  avatarConfig: AvatarConfig;
};

function normDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function entityToSummary(entity: Entity): PrincipalProfileSummary {
  const principalId = entity.entityId;
  return {
    displayName: normDisplayName(entity.attributes[ProfileAttr.displayName]),
    avatarConfig: resolveAvatarConfig(
      entity.attributes as Record<string, unknown> | undefined,
      principalId,
      ProfileAttr.avatarConfig
    ),
  };
}

/**
 * Batch-load profiles keyed by principal id (`profile` entity id === principal id).
 */
export function useProfilesForPrincipals(principalIds: string[]): {
  profilesByPrincipal: Map<string, PrincipalProfileSummary>;
  loading: boolean;
} {
  const sortedUniqueIds = useMemo(
    () => [...new Set(principalIds)].sort(),
    [principalIds]
  );

  const query = useMemo(
    () =>
      sortedUniqueIds.length === 0
        ? { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
        : { entityType: PROFILE_ENTITY_TYPE, entityId: sortedUniqueIds },
    [sortedUniqueIds]
  );

  const result = useEntities(query);

  const profilesByPrincipal = useMemo(() => {
    const m = new Map<string, PrincipalProfileSummary>();
    for (const e of result.entities) {
      m.set(e.entityId, entityToSummary(e));
    }
    return m;
  }, [result.entities]);

  return { profilesByPrincipal, loading: result.loading };
}
