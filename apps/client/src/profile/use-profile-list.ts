import { useAuth } from '@gamezilla/client/auth/auth-context';
import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import {
  ACCOUNT_ENTITY_TYPE,
  AccountAttr,
  PRINCIPAL_ENTITY_TYPE,
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { resolveAvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function isDeleted(attrs: Record<string, unknown>): boolean {
  return attrs[ProfileAttr.deleted] === true;
}

function normDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export type ProfileListItem = {
  profileId: string;
  displayName: string | null;
  avatarConfig: AvatarConfig;
  isCurrent: boolean;
  /** Principal that created this profile row; null on legacy rows before this field existed. */
  createdByPrincipalId: string | null;
};

function entityToItem(
  entity: Entity,
  currentId: string | null
): ProfileListItem | null {
  const attrs = entity.attributes as Record<string, unknown>;
  if (isDeleted(attrs)) return null;
  return {
    profileId: entity.entityId,
    displayName: normDisplayName(attrs[ProfileAttr.displayName]),
    avatarConfig: resolveAvatarConfig(
      attrs,
      entity.entityId,
      ProfileAttr.avatarConfig
    ),
    isCurrent: currentId !== null && entity.entityId === currentId,
    createdByPrincipalId: readStringAttr(
      attrs,
      ProfileAttr.createdByPrincipalId
    ),
  };
}

/**
 * All non-deleted profiles in PatchDB, with `isCurrent` from account (when signed in) then principal pointer.
 */
export function useProfiles(): {
  profiles: ProfileListItem[];
  currentProfileId: string | null;
  loading: boolean;
} {
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();
  const auth = useAuth();

  const principalRes = useEntities({
    entityType: PRINCIPAL_ENTITY_TYPE,
    entityId: principalId,
  });
  const accountId = auth.accountId;
  const accountRes = useEntities(
    accountId === null
      ? { entityType: ACCOUNT_ENTITY_TYPE, limit: 0 }
      : { entityType: ACCOUNT_ENTITY_TYPE, entityId: accountId }
  );

  const profilesRes = useEntities({
    entityType: PROFILE_ENTITY_TYPE,
  });

  const principalPtr = readStringAttr(
    principalRes.entities[0]?.attributes as Record<string, unknown> | undefined,
    PrincipalAttr.currentProfileId
  );
  const accountPtr = readStringAttr(
    accountId === null
      ? undefined
      : (accountRes.entities[0]?.attributes as Record<string, unknown> | undefined),
    AccountAttr.currentProfileId
  );

  const currentProfileId = useMemo(() => {
    if (auth.mode === 'signed-in') {
      return accountPtr ?? principalPtr ?? null;
    }
    return principalPtr ?? null;
  }, [auth.mode, accountPtr, principalPtr]);

  const loading =
    principalRes.loading ||
    (auth.mode === 'signed-in' && accountRes.loading) ||
    profilesRes.loading;

  const profiles = useMemo(() => {
    const items: ProfileListItem[] = [];
    for (const e of profilesRes.entities) {
      const row = entityToItem(e, currentProfileId);
      if (row !== null) items.push(row);
    }
    items.sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      const an = a.displayName ?? '';
      const bn = b.displayName ?? '';
      return an.localeCompare(bn);
    });
    return items;
  }, [profilesRes.entities, currentProfileId]);

  return { profiles, currentProfileId, loading };
}
