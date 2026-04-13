import { useAuth } from '@/features/auth/auth-context';
import { PrincipalServiceToken } from '@/features/auth/principal-service';
import { useEntity } from '@gamezilla/patch-db/react';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/shared/profile/profile-entities';
import { useDependency } from '@gamezilla/shared/dependency-injection/react';
import { useMemo } from 'react';

/**
 * PatchDB-backed profile (decoupled from {@link AuthState}).
 * Display label falls back to session semantics when `profile/displayName` is empty.
 */
export function useProfile() {
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();
  const entity = useEntity({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: principalId,
  });
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

    const rawSeed = entity?.attributes[ProfileAttr.avatarSeed];
    const storedSeed = typeof rawSeed === 'string' ? rawSeed.trim() : '';
    const avatarSeed = storedSeed.length > 0 ? storedSeed : principalId;

    return {
      principalId,
      entity,
      displayLabel,
      avatarSeed,
      hasCustomDisplayName: trimmed.length > 0,
    };
  }, [entity, principalId, auth.mode]);
}
