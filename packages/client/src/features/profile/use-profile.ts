import { useAuth } from '@/features/auth/auth-context';
import { PrincipalServiceToken } from '@/features/auth/principal-service';
import { useEntities } from '@gamezilla/patch-db/react';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/shared/profile/profile-entities';
import { resolveAvatarConfig } from '@gamezilla/shared/profile/avatar-config';
import { useDependency } from '@gamezilla/shared/dependency-injection/react';
import { useMemo } from 'react';

/**
 * PatchDB-backed profile (decoupled from {@link AuthState}).
 * Display label falls back to session semantics when `profile/displayName` is empty.
 *
 * `loading` is `true` until PatchDB has delivered its first subscription
 * result. Consumers should use it to avoid flashing a default
 * (principal-id-seeded) avatar before the real, persisted one is available.
 */
export function useProfile() {
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();
  const result = useEntities({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: principalId,
  });
  const entity = result.entities[0] ?? null;
  const loading = result.loading;
  const auth = useAuth();

  return useMemo(() => {
    const rawName = entity?.attributes[ProfileAttr.displayName];
    const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
    const displayLabel =
      trimmed.length > 0
        ? trimmed
        : auth.mode === 'signed-in'
          ? 'Signed in'
          : 'Guest';

    const avatarConfig = resolveAvatarConfig(
      entity?.attributes as Record<string, unknown> | undefined,
      principalId,
      ProfileAttr.avatarConfig,
    );

    return {
      principalId,
      entity,
      loading,
      displayLabel,
      avatarConfig,
      hasCustomDisplayName: trimmed.length > 0,
    };
  }, [entity, loading, principalId, auth.mode]);
}
