import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  PATCH_LAST_MODIFIED_BY_ACCOUNT,
  PATCH_LAST_MODIFIED_BY_PRINCIPAL,
} from '@gamezilla/patch-db/metadata/patch-metadata';
import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import { parseAvatarConfigAttr } from '@gamezilla/domain/profile/avatar-config';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { Entity, PatchesDbQueryWhereClause } from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

import { displayNameForPrincipal } from './principal-display';

const NO_ENTITY_PLACEHOLDER = '__patch_db_no_entity__';

function profileStampWhere(args: {
  signedIn: boolean;
  accountId: string | null;
  principalId: string;
}): PatchesDbQueryWhereClause {
  const { signedIn, accountId, principalId } = args;
  if (signedIn && accountId !== null) {
    return {
      type: '=',
      attribute: PATCH_LAST_MODIFIED_BY_ACCOUNT,
      value: accountId,
    };
  }
  return {
    type: 'and',
    clauses: [
      {
        type: '=',
        attribute: PATCH_LAST_MODIFIED_BY_PRINCIPAL,
        value: principalId,
      },
      {
        type: 'not_exists',
        attribute: PATCH_LAST_MODIFIED_BY_ACCOUNT,
      },
    ],
  };
}

type ProfileResult = {
  principalId: string;
  /** Profile row id (`accountId` when signed in, else `principalId`), or null when missing. */
  profileId: string | null;
  entity: Entity | null;
  loading: boolean;
  displayLabel: string;
  /** `null` when no persisted `profile/avatarConfig` on the profile row. */
  avatarConfig: AvatarConfig | null;
};

function buildProfileResult(args: {
  principalId: string;
  effectiveProfileId: string;
  profileEntity: Entity | null;
  profileQueryId: string;
  loading: boolean;
}): ProfileResult {
  const { principalId, effectiveProfileId, profileEntity, profileQueryId, loading } =
    args;
  const attrs = profileEntity?.attributes as
    | Record<string, unknown>
    | undefined;
  const usable =
    profileEntity !== null && profileQueryId !== NO_ENTITY_PLACEHOLDER;
  const displayLabel = displayNameForPrincipal(
    usable ? attrs?.[ProfileAttr.displayName] : undefined,
    principalId
  );
  const avatarConfig = usable
    ? parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig)
    : null;
  return {
    principalId,
    profileId: usable ? effectiveProfileId : null,
    entity: usable ? profileEntity : null,
    loading,
    displayLabel,
    avatarConfig,
  };
}

/**
 * PatchDB-backed profile for the current session identity.
 * Profile `entityId` is `accountId` when signed in, otherwise `principalId`.
 * Reads are filtered by last-modified stamps for defense in depth.
 */
export function useProfile() {
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();
  const auth = useAuth();
  const signedIn = auth.mode === 'signed-in';
  const accountId = auth.accountId;

  const effectiveProfileId =
    signedIn && accountId !== null ? accountId : principalId;

  const stampWhere = useMemo(
    () =>
      profileStampWhere({
        signedIn,
        accountId,
        principalId,
      }),
    [signedIn, accountId, principalId]
  );

  const profileQueryId =
    effectiveProfileId.length > 0 ? effectiveProfileId : NO_ENTITY_PLACEHOLDER;

  const profileRes = useEntities({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileQueryId,
    where: stampWhere,
  });
  const profileEntity = profileRes.entities[0] ?? null;

  const loading = profileRes.loading;

  return useMemo(
    () =>
      buildProfileResult({
        principalId,
        effectiveProfileId,
        profileEntity,
        profileQueryId,
        loading,
      }),
    [principalId, effectiveProfileId, profileEntity, profileQueryId, loading]
  );
}
