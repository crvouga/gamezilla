import { useAuth } from '@gamezilla/client/auth/auth-context';
import { useDeviceService } from '@gamezilla/client/runtime/runtime-hooks';
import { displayNameForDevice } from '@gamezilla/client/profile/device-display';
import { DeviceAttr } from '@gamezilla/domain/auth';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { parseAvatarConfigAttr } from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Identity of the current viewer in the form needed by the device display
 * helpers below: device id is always available; account id is only set when
 * the viewer is signed in.
 */
export function useSelfAuthIdentity(): {
  selfDeviceId: string;
  selfAccountId: string | null;
} {
  const deviceService = useDeviceService();
  const auth = useAuth();
  return {
    selfDeviceId: deviceService.getDeviceId(),
    selfAccountId: auth.mode === 'signed-in' ? auth.accountId : null,
  };
}

/**
 * Resolves the profile entity id to look up for a device:
 * - When `deviceId` is the current viewer and they're signed in, use the
 *   auth-supplied accountId directly (matches `useProfile()`).
 * - Otherwise read `device/accountId` from the device entity, falling
 *   back to the device-local profile id.
 */
export function resolveProfileKey(args: {
  deviceId: string;
  deviceById: Map<string, Entity>;
  selfDeviceId: string;
  selfAccountId: string | null;
}): string {
  const { deviceId, deviceById, selfDeviceId, selfAccountId } = args;
  if (deviceId === selfDeviceId && selfAccountId !== null) {
    return selfAccountId;
  }
  const deviceEntity = deviceById.get(deviceId);
  const accountIdAttr = readStringAttr(
    deviceEntity?.attributes as Record<string, unknown> | undefined,
    DeviceAttr.accountId
  );
  return accountIdAttr ?? deviceId;
}

export function devicePresentation(args: {
  deviceId: string;
  deviceById: Map<string, Entity>;
  profileById: Map<string, Entity>;
  selfDeviceId: string;
  selfAccountId: string | null;
}): { displayName: string; avatarConfig: AvatarConfig | null } {
  const profileKey = resolveProfileKey(args);
  const profileEntity = args.profileById.get(profileKey);
  const attrs = profileEntity?.attributes as
    | Record<string, unknown>
    | undefined;
  return {
    displayName: displayNameForDevice(
      attrs?.[ProfileAttr.displayName],
      args.deviceId
    ),
    avatarConfig: parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig),
  };
}

/**
 * Loads the current viewer's account-scoped profile (when signed in) so
 * callers can layer it onto bulk-fetched profile maps. This makes display
 * lookups fall back to the live account display name without waiting for the
 * device entity's `accountId` attribute to sync.
 */
export function useSelfAccountProfile(selfAccountId: string | null): {
  entity: Entity | null;
} {
  const res = useQuery(
    selfAccountId !== null
      ? { entityType: PROFILE_ENTITY_TYPE, entityId: selfAccountId }
      : { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
  );
  return { entity: res.entities[0] ?? null };
}

export function withSelfAccountProfile(
  profileById: Map<string, Entity>,
  selfAccountId: string | null,
  selfAccountProfile: Entity | null
): Map<string, Entity> {
  if (selfAccountId === null || selfAccountProfile === null) return profileById;
  return new Map(profileById).set(selfAccountId, selfAccountProfile);
}
