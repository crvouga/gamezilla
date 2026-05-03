import { useAuth } from '@gamezilla/client/auth/auth-context';
import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import { displayNameForPrincipal } from '@gamezilla/client/profile/principal-display';
import { PrincipalAttr } from '@gamezilla/domain/auth';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { parseAvatarConfigAttr } from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Identity of the current viewer in the form needed by the principal display
 * helpers below: principal id is always available; account id is only set when
 * the viewer is signed in.
 */
export function useSelfAuthIdentity(): {
  selfPrincipalId: string;
  selfAccountId: string | null;
} {
  const principalService = useDependency(PrincipalServiceToken);
  const auth = useAuth();
  return {
    selfPrincipalId: principalService.getPrincipalId(),
    selfAccountId: auth.mode === 'signed-in' ? auth.accountId : null,
  };
}

/**
 * Resolves the profile entity id to look up for a principal:
 * - When `principalId` is the current viewer and they're signed in, use the
 *   auth-supplied accountId directly (matches `useProfile()`).
 * - Otherwise read `principal/accountId` from the principal entity, falling
 *   back to the principal-local profile id.
 */
export function resolveProfileKey(args: {
  principalId: string;
  principalById: Map<string, Entity>;
  selfPrincipalId: string;
  selfAccountId: string | null;
}): string {
  const { principalId, principalById, selfPrincipalId, selfAccountId } = args;
  if (principalId === selfPrincipalId && selfAccountId !== null) {
    return selfAccountId;
  }
  const principalRow = principalById.get(principalId);
  const accountIdAttr = readStringAttr(
    principalRow?.attributes as Record<string, unknown> | undefined,
    PrincipalAttr.accountId
  );
  return accountIdAttr ?? principalId;
}

export function principalPresentation(args: {
  principalId: string;
  principalById: Map<string, Entity>;
  profileById: Map<string, Entity>;
  selfPrincipalId: string;
  selfAccountId: string | null;
}): { displayName: string; avatarConfig: AvatarConfig | null } {
  const profileKey = resolveProfileKey(args);
  const profileEntity = args.profileById.get(profileKey);
  const attrs = profileEntity?.attributes as Record<string, unknown> | undefined;
  return {
    displayName: displayNameForPrincipal(
      attrs?.[ProfileAttr.displayName],
      args.principalId
    ),
    avatarConfig: parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig),
  };
}

/**
 * Loads the current viewer's account-scoped profile (when signed in) so
 * callers can layer it onto bulk-fetched profile maps. This makes display
 * lookups fall back to the live account display name without waiting for the
 * principal entity's `accountId` attribute to sync.
 */
export function useSelfAccountProfile(selfAccountId: string | null): {
  entity: Entity | null;
  loading: boolean;
} {
  const res = useEntities(
    selfAccountId !== null
      ? { entityType: PROFILE_ENTITY_TYPE, entityId: selfAccountId }
      : { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
  );
  return { entity: res.entities[0] ?? null, loading: res.loading };
}

export function withSelfAccountProfile(
  profileById: Map<string, Entity>,
  selfAccountId: string | null,
  selfAccountProfile: Entity | null
): Map<string, Entity> {
  if (selfAccountId === null || selfAccountProfile === null) return profileById;
  return new Map(profileById).set(selfAccountId, selfAccountProfile);
}
