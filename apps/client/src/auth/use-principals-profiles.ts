import { displayNameForPrincipal } from '@gamezilla/client/profile/principal-display';
import {
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { parseAvatarConfigAttr } from '@gamezilla/domain/profile/avatar-config';
import { ProfileAttr } from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useMemo } from 'react';

import { usePrincipalProfileEntities } from './use-principal-profile-entities';

export type PrincipalProfileSummary = {
  displayName: string;
  avatarConfig: AvatarConfig | null;
};

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function profileIdForPrincipal(
  principalRow: Entity | undefined,
  principalId: string
): string {
  const accountId = readStringAttr(
    principalRow?.attributes as Record<string, unknown> | undefined,
    PrincipalAttr.accountId
  );
  return accountId ?? principalId;
}

function summaryForPrincipal(
  principalId: string,
  principalById: Map<string, Entity>,
  profileById: Map<string, Entity>
): PrincipalProfileSummary {
  const principalRow = principalById.get(principalId);
  const profileId = profileIdForPrincipal(principalRow, principalId);
  const prof = profileById.get(profileId);
  if (prof === undefined) {
    return {
      displayName: displayNameForPrincipal(undefined, principalId),
      avatarConfig: null,
    };
  }
  const attrs = prof.attributes as Record<string, unknown>;
  return {
    displayName: displayNameForPrincipal(attrs[ProfileAttr.displayName], principalId),
    avatarConfig: parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig),
  };
}

/**
 * Batch-load profiles for principals: account profile when `principal/accountId`
 * is set, else principal-local profile.
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
