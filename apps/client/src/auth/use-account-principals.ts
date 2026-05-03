import { PRINCIPAL_ENTITY_TYPE, PrincipalAttr } from '@gamezilla/domain/auth';
import type { Entity } from '@gamezilla/patch-db/interface';
import { useEntities } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

/** Stable empty query when signed out so `useEntities` does not resubscribe every render. */
const NO_ACCOUNT_PRINCIPALS_QUERY = {
  entityType: PRINCIPAL_ENTITY_TYPE,
  limit: 0 as const,
};

export type AccountPrincipal = {
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

/** Map a `principal` entity row to {@link AccountPrincipal} (e.g. detail screen fallback). */
export function accountPrincipalFromEntity(
  e: Entity,
  currentPrincipalId: string
): AccountPrincipal {
  return {
    entityId: e.entityId,
    isCurrentDevice: e.entityId === currentPrincipalId,
    createdAt: normString(e.attributes[PrincipalAttr.createdAt]),
    firstSeenAt: normString(e.attributes[PrincipalAttr.firstSeenAt]),
    lastSeenAt: normString(e.attributes[PrincipalAttr.lastSeenAt]),
    platform: normString(e.attributes[PrincipalAttr.platform]),
    osName: normString(e.attributes[PrincipalAttr.osName]),
    osVersion: normString(e.attributes[PrincipalAttr.osVersion]),
    deviceModelName: normString(e.attributes[PrincipalAttr.deviceModelName]),
    deviceBrand: normString(e.attributes[PrincipalAttr.deviceBrand]),
    deviceName: normString(e.attributes[PrincipalAttr.deviceName]),
    appVersion: normString(e.attributes[PrincipalAttr.appVersion]),
    appBuildNumber: normString(e.attributes[PrincipalAttr.appBuildNumber]),
    userAgent: normString(e.attributes[PrincipalAttr.userAgent]),
  };
}

function lastSeenMs(p: AccountPrincipal): number {
  const raw = p.lastSeenAt ?? p.createdAt;
  if (raw === null) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function mergePrincipalsForAccount(args: {
  accountEntities: Entity[];
  localEntities: Entity[];
  currentPrincipalId: string;
}): AccountPrincipal[] {
  const { accountEntities, localEntities, currentPrincipalId } = args;
  const byId = new Map<string, Entity>();
  for (const e of accountEntities) {
    byId.set(e.entityId, e);
  }
  const self = localEntities[0];
  if (self !== undefined) {
    byId.set(self.entityId, self);
  }
  const list = [...byId.values()].map((e) =>
    accountPrincipalFromEntity(e, currentPrincipalId)
  );
  return [...list].sort((a, b) => {
    if (a.isCurrentDevice !== b.isCurrentDevice) {
      return a.isCurrentDevice ? -1 : 1;
    }
    return lastSeenMs(b) - lastSeenMs(a);
  });
}

/**
 * Principals bound to `accountId`, or the local principal only when `accountId` is null.
 * When signed in, merges an explicit fetch of the local principal so it still appears if
 * `principal/accountId` is not yet replicated on the row.
 *
 * Cross-device: `createPatchDbHcTransport` posts arbitrary `PatchesDbQuery` / patches to
 * `/patch-db` with no principal-scoped filter — other devices' `principal` rows appear
 * here once their patches have synced through the shared patch stream.
 */
export function useAccountPrincipals(
  accountId: string | null,
  currentPrincipalId: string
): { principals: AccountPrincipal[]; loading: boolean } {
  const localQuery = useMemo(
    () => ({
      entityType: PRINCIPAL_ENTITY_TYPE,
      entityId: currentPrincipalId,
      limit: 1 as const,
    }),
    [currentPrincipalId]
  );

  const accountQuery = useMemo(
    () =>
      accountId === null
        ? null
        : {
            entityType: PRINCIPAL_ENTITY_TYPE,
            where: {
              type: '=' as const,
              attribute: PrincipalAttr.accountId,
              value: accountId,
            },
            orderBy: [
              {
                attribute: PrincipalAttr.lastSeenAt,
                direction: 'desc' as const,
              },
            ],
            limit: 200,
          },
    [accountId]
  );

  const localResult = useEntities(localQuery);
  const accountResult = useEntities(
    accountQuery ?? NO_ACCOUNT_PRINCIPALS_QUERY
  );

  const principals = useMemo(() => {
    if (accountId === null) {
      return localResult.entities.map((e) =>
        accountPrincipalFromEntity(e, currentPrincipalId)
      );
    }
    return mergePrincipalsForAccount({
      accountEntities: accountResult.entities,
      localEntities: localResult.entities,
      currentPrincipalId,
    });
  }, [
    accountId,
    accountResult.entities,
    currentPrincipalId,
    localResult.entities,
  ]);

  const loading =
    accountId === null
      ? localResult.loading
      : localResult.loading || accountResult.loading;

  return { principals, loading };
}
