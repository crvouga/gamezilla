import { useAuth } from '@gamezilla/client/auth/auth-context';
import { useDeviceService } from '@gamezilla/client/runtime/runtime-hooks';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { parseAvatarConfigAttr } from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

import { displayNameForDevice } from './device-display';

const NO_ENTITY_PLACEHOLDER = '__patch_db_no_entity__';

type ProfileResult = {
  deviceId: string;
  /**
   * Writable profile row id (`accountId` when signed in, else `deviceId`).
   * Non-null whenever we can derive an id for the current session — does NOT
   * gate on the patch-db row having hydrated, because the runtime bootstrap
   * (`entityBootstrapEffect`) creates the row idempotently and writes target
   * the id directly. Only `null` when neither account nor device id is known.
   */
  profileId: string | null;
  entity: Entity | null;
  displayLabel: string;
  /** `null` when no persisted `profile/avatarConfig` on the profile row. */
  avatarConfig: AvatarConfig | null;
};

function buildProfileResult(args: {
  deviceId: string;
  effectiveProfileId: string;
  profileEntity: Entity | null;
  profileQueryId: string;
}): ProfileResult {
  const { deviceId, effectiveProfileId, profileEntity, profileQueryId } = args;
  const attrs = profileEntity?.attributes as
    | Record<string, unknown>
    | undefined;
  const usable =
    profileEntity !== null && profileQueryId !== NO_ENTITY_PLACEHOLDER;
  const displayLabel = displayNameForDevice(
    usable ? attrs?.[ProfileAttr.displayName] : undefined,
    deviceId
  );
  const avatarConfig = usable
    ? parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig)
    : null;
  return {
    deviceId,
    profileId: effectiveProfileId.length > 0 ? effectiveProfileId : null,
    entity: usable ? profileEntity : null,
    displayLabel,
    avatarConfig,
  };
}

/**
 * PatchDB-backed profile for the current session identity.
 * Profile `entityId` is `useAuth().myId` (account id when signed in, else install id).
 */
export function useProfile() {
  const deviceService = useDeviceService();
  const deviceId = deviceService.getDeviceId();
  const auth = useAuth();
  const effectiveProfileId = auth.myId.length > 0 ? auth.myId : deviceId;

  const profileQueryId =
    effectiveProfileId.length > 0 ? effectiveProfileId : NO_ENTITY_PLACEHOLDER;

  const profileRes = useQuery({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileQueryId,
  });
  const profileEntity = profileRes.entities[0] ?? null;

  return useMemo(
    () =>
      buildProfileResult({
        deviceId,
        effectiveProfileId,
        profileEntity,
        profileQueryId,
      }),
    [deviceId, effectiveProfileId, profileEntity, profileQueryId]
  );
}
