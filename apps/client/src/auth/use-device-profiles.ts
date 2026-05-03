import { displayNameForDevice } from '@gamezilla/client/profile/device-display';
import { DeviceAttr } from '@gamezilla/domain/auth';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { parseAvatarConfigAttr } from '@gamezilla/domain/profile/avatar-config';
import { ProfileAttr } from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useMemo } from 'react';

import { useDeviceProfileEntities } from './use-device-profile-entities';

export type DeviceProfileSummary = {
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

function profileIdForDevice(
  deviceEntity: Entity | undefined,
  deviceId: string
): string {
  const accountId = readStringAttr(
    deviceEntity?.attributes as Record<string, unknown> | undefined,
    DeviceAttr.accountId
  );
  return accountId ?? deviceId;
}

function summaryForDevice(
  deviceId: string,
  deviceById: Map<string, Entity>,
  profileById: Map<string, Entity>
): DeviceProfileSummary {
  const deviceEntity = deviceById.get(deviceId);
  const profileId = profileIdForDevice(deviceEntity, deviceId);
  const prof = profileById.get(profileId);
  if (prof === undefined) {
    return {
      displayName: displayNameForDevice(undefined, deviceId),
      avatarConfig: null,
    };
  }
  const attrs = prof.attributes as Record<string, unknown>;
  return {
    displayName: displayNameForDevice(attrs[ProfileAttr.displayName], deviceId),
    avatarConfig: parseAvatarConfigAttr(attrs, ProfileAttr.avatarConfig),
  };
}

/**
 * Batch-load profiles for devices: account profile when `device/accountId`
 * is set, else device-local profile.
 */
export function useProfilesForDevices(deviceIds: string[]): {
  profilesByDevice: Map<string, DeviceProfileSummary>;
} {
  const { deviceById, profileById } = useDeviceProfileEntities(deviceIds);

  const profilesByDevice = useMemo(() => {
    const m = new Map<string, DeviceProfileSummary>();
    for (const id of new Set(deviceIds)) {
      m.set(id, summaryForDevice(id, deviceById, profileById));
    }
    return m;
  }, [deviceById, profileById, deviceIds]);

  return { profilesByDevice };
}
