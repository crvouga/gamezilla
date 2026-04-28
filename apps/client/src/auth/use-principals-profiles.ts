import {
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { resolveAvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { ProfileAttr } from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useMemo } from 'react';

import {
  isProfileEntityDeleted,
  usePrincipalProfileEntities,
} from './use-principal-profile-entities';

export type PrincipalProfileSummary = {
  displayName: string | null;
  avatarConfig: AvatarConfig;
};

function normDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function entityToSummary(
  entity: Entity,
  fallbackSeed: string
): PrincipalProfileSummary {
  const attrs = entity.attributes as Record<string, unknown>;
  return {
    displayName: normDisplayName(attrs[ProfileAttr.displayName]),
    avatarConfig: resolveAvatarConfig(
      attrs,
      fallbackSeed,
      ProfileAttr.avatarConfig
    ),
  };
}

function summaryForPrincipal(
  principalId: string,
  principalById: Map<string, Entity>,
  profileById: Map<string, Entity>
): PrincipalProfileSummary {
  const principalRow = principalById.get(principalId);
  const profileId = readStringAttr(
    principalRow?.attributes as Record<string, unknown> | undefined,
    PrincipalAttr.currentProfileId
  );
  if (profileId === null) {
    return {
      displayName: null,
      avatarConfig: resolveAvatarConfig(
        undefined,
        principalId,
        ProfileAttr.avatarConfig
      ),
    };
  }
  const prof = profileById.get(profileId);
  if (prof === undefined || isProfileEntityDeleted(prof)) {
    return {
      displayName: null,
      avatarConfig: resolveAvatarConfig(
        undefined,
        principalId,
        ProfileAttr.avatarConfig
      ),
    };
  }
  return entityToSummary(prof, principalId);
}

/**
 * Batch-load current profiles for principals via `principal/currentProfileId` → `profile` row.
 */
export function useProfilesForPrincipals(principalIds: string[]): {
  profilesByPrincipal: Map<string, PrincipalProfileSummary>;
  loading: boolean;
} {
  const { principalById, profileById, loading } =
    usePrincipalProfileEntities(principalIds);

  const profilesByPrincipal = useMemo(() => {
    const m = new Map<string, PrincipalProfileSummary>();
    for (const id of new Set(principalIds)) {
      m.set(id, summaryForPrincipal(id, principalById, profileById));
    }
    return m;
  }, [principalById, profileById, principalIds]);

  return { profilesByPrincipal, loading };
}
