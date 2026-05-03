import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

const NO_ACCOUNT_DEVICES_QUERY = {
  entityType: DEVICE_ENTITY_TYPE,
  limit: 0 as const,
};

export type AccountDevice = {
  entityId: string;
  isCurrentDevice: boolean;
  createdAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  platform: string | null;
  osName: string | null;
  osVersion: string | null;
  deviceModelName: string | null;
  deviceBrand: string | null;
  deviceName: string | null;
  appVersion: string | null;
  appBuildNumber: string | null;
  userAgent: string | null;
};

function normString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Map a `device` entity row to {@link AccountDevice} (e.g. detail screen fallback). */
export function accountDeviceFromEntity(
  e: Entity,
  currentDeviceId: string
): AccountDevice {
  return {
    entityId: e.entityId,
    isCurrentDevice: e.entityId === currentDeviceId,
    createdAt: normString(e.attributes[DeviceAttr.createdAt]),
    firstSeenAt: normString(e.attributes[DeviceAttr.firstSeenAt]),
    lastSeenAt: normString(e.attributes[DeviceAttr.lastSeenAt]),
    platform: normString(e.attributes[DeviceAttr.platform]),
    osName: normString(e.attributes[DeviceAttr.osName]),
    osVersion: normString(e.attributes[DeviceAttr.osVersion]),
    deviceModelName: normString(e.attributes[DeviceAttr.deviceModelName]),
    deviceBrand: normString(e.attributes[DeviceAttr.deviceBrand]),
    deviceName: normString(e.attributes[DeviceAttr.deviceName]),
    appVersion: normString(e.attributes[DeviceAttr.appVersion]),
    appBuildNumber: normString(e.attributes[DeviceAttr.appBuildNumber]),
    userAgent: normString(e.attributes[DeviceAttr.userAgent]),
  };
}

function lastSeenMs(p: AccountDevice): number {
  const raw = p.lastSeenAt ?? p.createdAt;
  if (raw === null) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function mergeDevicesForAccount(args: {
  accountEntities: Entity[];
  localEntities: Entity[];
  currentDeviceId: string;
}): AccountDevice[] {
  const { accountEntities, localEntities, currentDeviceId } = args;
  const byId = new Map<string, Entity>();
  for (const e of accountEntities) {
    byId.set(e.entityId, e);
  }
  const self = localEntities[0];
  if (self !== undefined) {
    byId.set(self.entityId, self);
  }
  const list = [...byId.values()].map((e) =>
    accountDeviceFromEntity(e, currentDeviceId)
  );
  return [...list].sort((a, b) => {
    if (a.isCurrentDevice !== b.isCurrentDevice) {
      return a.isCurrentDevice ? -1 : 1;
    }
    return lastSeenMs(b) - lastSeenMs(a);
  });
}

/**
 * Devices bound to `accountId`, or the local device only when `accountId` is null.
 * When signed in, merges an explicit fetch of the local device so it still appears if
 * `device/accountId` is not yet replicated on the row.
 *
 * Cross-device: `createPatchDbHcTransport` posts arbitrary `PatchDbQuery` / patches to
 * `/patch-db` with no device-scoped filter — other installs' `device` rows appear
 * here once their patches have synced through the shared patch stream.
 */
export function useAccountDevices(
  accountId: string | null,
  currentDeviceId: string
): { devices: AccountDevice[] } {
  const localQuery = useMemo(
    () => ({
      entityType: DEVICE_ENTITY_TYPE,
      entityId: currentDeviceId,
      limit: 1 as const,
    }),
    [currentDeviceId]
  );

  const accountDevicesQuery = useMemo(
    () =>
      accountId === null
        ? null
        : {
            entityType: DEVICE_ENTITY_TYPE,
            where: {
              type: '=' as const,
              attribute: DeviceAttr.accountId,
              value: accountId,
            },
            orderBy: [
              {
                attribute: DeviceAttr.lastSeenAt,
                direction: 'desc' as const,
              },
            ],
            limit: 200,
          },
    [accountId]
  );

  const localResult = useQuery(localQuery);
  const accountDevicesResult = useQuery(
    accountDevicesQuery ?? NO_ACCOUNT_DEVICES_QUERY
  );

  const devices = useMemo(() => {
    if (accountId === null) {
      return localResult.entities.map((e) =>
        accountDeviceFromEntity(e, currentDeviceId)
      );
    }
    return mergeDevicesForAccount({
      accountEntities: accountDevicesResult.entities,
      localEntities: localResult.entities,
      currentDeviceId,
    });
  }, [
    accountId,
    accountDevicesResult.entities,
    currentDeviceId,
    localResult.entities,
  ]);

  return { devices };
}
