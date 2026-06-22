import {
  getCachedCurrentAccountId,
  useCurrentAccountId,
} from '@libs/auth/client/use-current-account-id';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useMemo } from 'react';

import type {
  AttributeKey,
  PatchDbQueryWhereClause,
} from '@pkgs/patch-db/interface';
import {
  SpaceAttr,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';

/** Stable install id + signed-in account id (when present). */
export function useReplicationIdentityIds(): readonly string[] {
  const accountId = useCurrentAccountId();
  const deviceId = useDeviceId();
  return useMemo(() => {
    const ids: string[] = [];
    if (accountId !== null && accountId.length > 0) ids.push(accountId);
    const cachedAccountId = getCachedCurrentAccountId();
    if (
      cachedAccountId !== null &&
      cachedAccountId.length > 0 &&
      !ids.includes(cachedAccountId)
    ) {
      ids.push(cachedAccountId);
    }
    if (deviceId !== null && deviceId.length > 0 && !ids.includes(deviceId)) {
      ids.push(deviceId);
    }
    return ids;
  }, [accountId, deviceId]);
}

export function isReplicationHost(
  hostId: string | null,
  identityIds: readonly string[]
): boolean {
  if (hostId === null || hostId.length === 0) return false;
  return identityIds.includes(hostId);
}

function identityEqualsWhere(
  attribute: AttributeKey,
  identityIds: readonly string[]
): PatchDbQueryWhereClause | null {
  if (identityIds.length === 0) return null;
  if (identityIds.length === 1) {
    return { type: '=', attribute, value: identityIds[0] };
  }
  return {
    type: 'or',
    clauses: identityIds.map((id) => ({
      type: '=',
      attribute,
      value: id,
    })),
  };
}

export function hostIdMatchesIdentityWhere(
  identityIds: readonly string[]
): PatchDbQueryWhereClause | null {
  return identityEqualsWhere(SpaceAttr.hostId.key, identityIds);
}

export function guestIdMatchesIdentityWhere(
  identityIds: readonly string[]
): PatchDbQueryWhereClause | null {
  return identityEqualsWhere(SpaceMembershipAttr.guestId.key, identityIds);
}
