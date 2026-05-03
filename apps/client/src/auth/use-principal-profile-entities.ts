import { PRINCIPAL_ENTITY_TYPE, PrincipalAttr } from '@gamezilla/domain/auth';
import { PROFILE_ENTITY_TYPE } from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export type PrincipalProfileEntityMaps = {
  principalById: Map<string, Entity>;
  profileById: Map<string, Entity>;
};

/**
 * Resolves profile id per principal: `principal/accountId` profile when bound,
 * otherwise the principal-local profile (`entityId === principalId`).
 */
function profileEntityIdForPrincipal(principalRow: Entity | undefined): string {
  const accountId = readStringAttr(
    principalRow?.attributes as Record<string, unknown> | undefined,
    PrincipalAttr.accountId
  );
  if (accountId !== null) return accountId;
  return principalRow?.entityId ?? '';
}

/**
 * Loads `principal` rows and their corresponding `profile` rows
 * (account-scoped or principal-scoped).
 */
export function usePrincipalProfileEntities(
  principalIds: string[]
): PrincipalProfileEntityMaps {
  const sortedUniqueIds = useMemo(
    () => [...new Set(principalIds)].sort(),
    [principalIds]
  );

  const principalsQuery = useMemo(
    () =>
      sortedUniqueIds.length === 0
        ? { entityType: PRINCIPAL_ENTITY_TYPE, limit: 0 }
        : { entityType: PRINCIPAL_ENTITY_TYPE, entityId: sortedUniqueIds },
    [sortedUniqueIds]
  );

  const principalsResult = useQuery(principalsQuery);

  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of principalsResult.entities) {
      const pid = profileEntityIdForPrincipal(p);
      if (pid.length > 0) ids.add(pid);
    }
    return [...ids].sort();
  }, [principalsResult.entities]);

  const profilesResult = useQuery(
    profileIds.length === 0
      ? { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
      : { entityType: PROFILE_ENTITY_TYPE, entityId: profileIds }
  );

  const principalById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const p of principalsResult.entities) {
      m.set(p.entityId, p);
    }
    return m;
  }, [principalsResult.entities]);

  const profileById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const p of profilesResult.entities) {
      m.set(p.entityId, p);
    }
    return m;
  }, [profilesResult.entities]);

  return { principalById, profileById };
}
