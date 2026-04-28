import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  LAST_MODIFIED_BY_ACCOUNT_ID_KEY,
  LAST_MODIFIED_BY_PRINCIPAL_ID_KEY,
} from '@gamezilla/client/auth/last-modified-by-patches-db';
import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import { resolveAvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { Entity, PatchesDbQueryWhereClause } from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

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
      attribute: LAST_MODIFIED_BY_ACCOUNT_ID_KEY,
      value: accountId,
    };
  }
  return {
    type: 'and',
    clauses: [
      {
        type: '=',
        attribute: LAST_MODIFIED_BY_PRINCIPAL_ID_KEY,
        value: principalId,
      },
      {
        type: 'not_exists',
        attribute: LAST_MODIFIED_BY_ACCOUNT_ID_KEY,
      },
    ],
  };
}

function deriveDisplayLabel(args: {
  loading: boolean;
  usable: boolean;
  trimmedName: string;
  signedIn: boolean;
}): string {
  const { loading, usable, trimmedName, signedIn } = args;
  if (loading) return '';
  if (!usable || trimmedName.length === 0) {
    return signedIn ? 'Signed in' : 'Guest';
  }
  return trimmedName;
}

type ProfileResult = {
  principalId: string;
  /** Profile row id (`accountId` when signed in, else `principalId`), or null when missing. */
  profileId: string | null;
  entity: Entity | null;
  loading: boolean;
  displayLabel: string;
  avatarConfig: ReturnType<typeof resolveAvatarConfig>;
  hasCustomDisplayName: boolean;
};

function trimDisplayName(
  attrs: Record<string, unknown> | undefined,
  usable: boolean
): string {
  const rawName = usable ? attrs?.[ProfileAttr.displayName] : undefined;
  return typeof rawName === 'string' ? rawName.trim() : '';
}

function buildProfileResult(args: {
  principalId: string;
  signedIn: boolean;
  effectiveProfileId: string;
  profileEntity: Entity | null;
  profileQueryId: string;
  loading: boolean;
}): ProfileResult {
  const {
    principalId,
    signedIn,
    effectiveProfileId,
    profileEntity,
    profileQueryId,
    loading,
  } = args;
  const attrs = profileEntity?.attributes as
    | Record<string, unknown>
    | undefined;
  const usable =
    profileEntity !== null && profileQueryId !== NO_ENTITY_PLACEHOLDER;
  const trimmedName = trimDisplayName(attrs, usable);
  const displayLabel = deriveDisplayLabel({
    loading,
    usable,
    trimmedName,
    signedIn,
  });
  const avatarConfig = resolveAvatarConfig(
    usable ? attrs : undefined,
    principalId,
    ProfileAttr.avatarConfig
  );
  return {
    principalId,
    profileId: usable ? effectiveProfileId : null,
    entity: usable ? profileEntity : null,
    loading,
    displayLabel,
    avatarConfig,
    hasCustomDisplayName: !loading && usable && trimmedName.length > 0,
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
        signedIn,
        effectiveProfileId,
        profileEntity,
        profileQueryId,
        loading,
      }),
    [
      principalId,
      signedIn,
      effectiveProfileId,
      profileEntity,
      profileQueryId,
      loading,
    ]
  );
}
