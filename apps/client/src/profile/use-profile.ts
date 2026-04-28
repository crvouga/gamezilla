import { useAuth } from '@gamezilla/client/auth/auth-context';
import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import {
  ACCOUNT_ENTITY_TYPE,
  AccountAttr,
  PRINCIPAL_ENTITY_TYPE,
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import { resolveAvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

const NO_ENTITY_PLACEHOLDER = '__patch_db_no_entity__';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function isDeleted(attrs: Record<string, unknown> | undefined): boolean {
  if (!attrs) return false;
  return attrs[ProfileAttr.deleted] === true;
}

function useEffectivePointers(): {
  principalEntity: Entity | null;
  accountEntity: Entity | null;
  effectiveProfileId: string | null;
  pointersLoading: boolean;
} {
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();
  const auth = useAuth();

  const principalRes = useEntities({
    entityType: PRINCIPAL_ENTITY_TYPE,
    entityId: principalId,
  });
  const principalEntity = principalRes.entities[0] ?? null;

  const accountId = auth.accountId;
  const accountRes = useEntities(
    accountId === null
      ? { entityType: ACCOUNT_ENTITY_TYPE, limit: 0 }
      : {
          entityType: ACCOUNT_ENTITY_TYPE,
          entityId: accountId,
        }
  );
  const accountEntity =
    accountId === null ? null : (accountRes.entities[0] ?? null);

  const principalPtr = readStringAttr(
    principalEntity?.attributes as Record<string, unknown> | undefined,
    PrincipalAttr.currentProfileId
  );
  const accountPtr = readStringAttr(
    accountEntity?.attributes as Record<string, unknown> | undefined,
    AccountAttr.currentProfileId
  );

  const effectiveProfileId = useMemo(() => {
    if (auth.mode === 'signed-in') {
      return accountPtr ?? principalPtr ?? null;
    }
    return principalPtr ?? null;
  }, [auth.mode, accountPtr, principalPtr]);

  const pointersLoading =
    principalRes.loading || (auth.mode === 'signed-in' && accountRes.loading);

  return {
    principalEntity,
    accountEntity,
    effectiveProfileId,
    pointersLoading,
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
  /** Resolved profile row id, or null when using synthetic fallback. */
  profileId: string | null;
  entity: Entity | null;
  loading: boolean;
  displayLabel: string;
  avatarConfig: ReturnType<typeof resolveAvatarConfig>;
  hasCustomDisplayName: boolean;
};

function isUsableProfile(args: {
  effectiveProfileId: string | null;
  profileEntity: Entity | null;
  profileQueryId: string;
  attrs: Record<string, unknown> | undefined;
}): boolean {
  const { effectiveProfileId, profileEntity, profileQueryId, attrs } = args;
  return (
    effectiveProfileId !== null &&
    profileEntity !== null &&
    profileQueryId !== NO_ENTITY_PLACEHOLDER &&
    !isDeleted(attrs)
  );
}

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
  effectiveProfileId: string | null;
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
  const usable = isUsableProfile({
    effectiveProfileId,
    profileEntity,
    profileQueryId,
    attrs,
  });
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

function useProfileResult(args: {
  principalId: string;
  signedIn: boolean;
  effectiveProfileId: string | null;
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
      signedIn,
      effectiveProfileId,
      loading,
      principalId,
      profileEntity,
      profileQueryId,
    ]
  );
}

/**
 * PatchDB-backed profile (decoupled from {@link AuthState}).
 * Effective profile = `account/currentProfileId` (when signed in) ?? `principal/currentProfileId`.
 * Display label falls back to session semantics when no usable profile row.
 *
 * `loading` is `true` until PatchDB has delivered first subscription results needed
 * to resolve the effective profile (or confirmed absence).
 */
export function useProfile() {
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();
  const auth = useAuth();
  const signedIn = auth.mode === 'signed-in';

  const { effectiveProfileId, pointersLoading } = useEffectivePointers();

  const profileQueryId =
    effectiveProfileId !== null ? effectiveProfileId : NO_ENTITY_PLACEHOLDER;

  const profileRes = useEntities({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileQueryId,
  });
  const profileEntity = profileRes.entities[0] ?? null;

  const loading =
    pointersLoading ||
    (effectiveProfileId !== null && profileRes.loading);

  return useProfileResult({
    principalId,
    signedIn,
    effectiveProfileId,
    profileEntity,
    profileQueryId,
    loading,
  });
}
