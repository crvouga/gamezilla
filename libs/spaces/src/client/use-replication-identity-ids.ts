import { useMyId } from '@libs/auth/client/use-current-user';
import { useMemo } from 'react';

import type {
  AttributeKey,
  PatchDbQueryWhereClause,
} from '@pkgs/patch-db/interface';
import {
  SpaceAttr,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';

/**
 * Replication ids for space host/guest PatchDB queries. Matches {@link useMyId}:
 * account id when signed in, install device id when anonymous — never both.
 * Including device id after sign-in would keep anonymous-only spaces "live".
 */
export function useReplicationIdentityIds(): readonly string[] {
  const myId = useMyId();
  return useMemo(() => (myId.length > 0 ? [myId] : []), [myId]);
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
