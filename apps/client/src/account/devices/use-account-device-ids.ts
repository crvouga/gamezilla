import { useMyDeviceId } from '@gamezilla/client/account/devices/use-my-device-id';
import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from '@gamezilla/domain/auth';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

const EMPTY_DEVICE_QUERY = {
  entityType: DEVICE_ENTITY_TYPE,
  limit: 0 as const,
};

const EMPTY_SESSION_QUERY = {
  entityType: ACCOUNT_SESSION_ENTITY_TYPE,
  limit: 0 as const,
};

function readString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function lastSeenMsOf(entity: Entity): number {
  const raw =
    readString(entity.attributes[DeviceAttr.lastSeenAt.key]) ??
    readString(entity.attributes[DeviceAttr.createdAt.key]);
  if (raw === null) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function buildLastSeenMap(args: {
  accountId: string | null;
  remoteDevices: readonly Entity[];
  localDevices: readonly Entity[];
}): Map<string, number> {
  const byId = new Map<string, number>();
  if (args.accountId !== null) {
    for (const e of args.remoteDevices) byId.set(e.entityId, lastSeenMsOf(e));
  }
  for (const e of args.localDevices) byId.set(e.entityId, lastSeenMsOf(e));
  return byId;
}

function sortDeviceIds(
  byId: Map<string, number>,
  currentDeviceId: string
): string[] {
  return [...byId.keys()].sort((a, b) => {
    if (a === currentDeviceId && b !== currentDeviceId) return -1;
    if (b === currentDeviceId && a !== currentDeviceId) return 1;
    return (byId.get(b) ?? 0) - (byId.get(a) ?? 0);
  });
}

function uniqueDeviceIdsFromSessions(sessions: readonly Entity[]): string[] {
  const s = new Set<string>();
  for (const e of sessions) {
    const did = e.attributes[AccountSessionAttr.deviceId.key];
    if (typeof did === 'string' && did.length > 0) s.add(did);
  }
  return [...s].sort();
}

/**
 * Device entity ids for the given account, plus the current install row when
 * signed in (so the current device shows up before sync). Sorted with the
 * current device first, then by `lastSeenAt` descending (falling back to
 * `createdAt`).
 *
 * Genuinely multi-query: sessions for the account → device ids → device
 * entities → merge with local install. Returns ids only.
 */
export function useAccountDeviceIds(accountId: string | null): string[] {
  const currentDeviceId = useMyDeviceId();

  const localQuery = useMemo(
    () => ({
      entityType: DEVICE_ENTITY_TYPE,
      entityId: currentDeviceId,
      limit: 1 as const,
    }),
    [currentDeviceId]
  );

  const sessionsQuery = useMemo(
    () =>
      accountId === null
        ? null
        : {
            entityType: ACCOUNT_SESSION_ENTITY_TYPE,
            where: {
              type: '=' as const,
              attribute: AccountSessionAttr.accountId.key,
              value: accountId,
            },
            limit: 500,
          },
    [accountId]
  );

  const localResult = useQuery(localQuery);
  const sessionsResult = useQuery(sessionsQuery ?? EMPTY_SESSION_QUERY);

  const deviceIdsFromSessions = useMemo(
    () => uniqueDeviceIdsFromSessions(sessionsResult.entities),
    [sessionsResult.entities]
  );

  const remoteDevicesQuery = useMemo(
    () =>
      accountId === null || deviceIdsFromSessions.length === 0
        ? EMPTY_DEVICE_QUERY
        : {
            entityType: DEVICE_ENTITY_TYPE,
            entityId: deviceIdsFromSessions,
          },
    [accountId, deviceIdsFromSessions]
  );

  const remoteDevicesResult = useQuery(remoteDevicesQuery);

  return useMemo(
    () =>
      sortDeviceIds(
        buildLastSeenMap({
          accountId,
          remoteDevices: remoteDevicesResult.entities,
          localDevices: localResult.entities,
        }),
        currentDeviceId
      ),
    [
      accountId,
      remoteDevicesResult.entities,
      localResult.entities,
      currentDeviceId,
    ]
  );
}
