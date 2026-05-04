import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { PROFILE_ENTITY_TYPE } from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

function readStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export type DeviceProfileEntityMaps = {
  deviceById: Map<string, Entity>;
  profileById: Map<string, Entity>;
};

/**
 * Resolves profile id per device: `device/accountId` profile when bound,
 * otherwise the device-local profile (`entityId === deviceId`).
 */
function profileEntityIdForDevice(deviceEntity: Entity | undefined): string {
  const accountId = readStringAttr(
    deviceEntity?.attributes as Record<string, unknown> | undefined,
    DeviceAttr.accountId
  );
  if (accountId !== null) return accountId;
  return deviceEntity?.entityId ?? '';
}

/**
 * Loads `device` rows and their corresponding `profile` rows
 * (account-scoped or device-scoped).
 */
export function useDeviceProfileEntities(
  deviceIds: string[]
): DeviceProfileEntityMaps {
  const sortedUniqueIds = useMemo(
    () => [...new Set(deviceIds)].sort(),
    [deviceIds]
  );

  const devicesQuery = useMemo(
    () =>
      sortedUniqueIds.length === 0
        ? { entityType: DEVICE_ENTITY_TYPE, limit: 0 }
        : { entityType: DEVICE_ENTITY_TYPE, entityId: sortedUniqueIds },
    [sortedUniqueIds]
  );

  const devicesResult = useQuery(devicesQuery);

  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of devicesResult.entities) {
      const pid = profileEntityIdForDevice(p);
      if (pid.length > 0) ids.add(pid);
    }
    return [...ids].sort();
  }, [devicesResult.entities]);

  const profilesResult = useQuery(
    profileIds.length === 0
      ? { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
      : { entityType: PROFILE_ENTITY_TYPE, entityId: profileIds }
  );

  const deviceById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const p of devicesResult.entities) {
      m.set(p.entityId, p);
    }
    return m;
  }, [devicesResult.entities]);

  const profileById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const p of profilesResult.entities) {
      m.set(p.entityId, p);
    }
    return m;
  }, [profilesResult.entities]);

  return { deviceById, profileById };
}

/**
 * Loads `profile` rows by entity id (e.g. account ids for space members).
 */
export function useProfileEntities(profileEntityIds: string[]): {
  profileById: Map<string, Entity>;
} {
  const sortedUniqueIds = useMemo(
    () => [...new Set(profileEntityIds)].filter((id) => id.length > 0).sort(),
    [profileEntityIds]
  );

  const profilesResult = useQuery(
    sortedUniqueIds.length === 0
      ? { entityType: PROFILE_ENTITY_TYPE, limit: 0 }
      : { entityType: PROFILE_ENTITY_TYPE, entityId: sortedUniqueIds }
  );

  const profileById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const p of profilesResult.entities) {
      m.set(p.entityId, p);
    }
    return m;
  }, [profilesResult.entities]);

  return { profileById };
}
