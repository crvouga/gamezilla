import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';
import type { Entity, PatchDbQuery, PatchDbQueryWhereClause } from '@pkgs/patch-db/interface';
import { useQuery } from '@pkgs/patch-db/react';
import { useMemo } from 'react';

import {
  guestIdMatchesIdentityWhere,
  hostIdMatchesIdentityWhere,
  useReplicationIdentityIds,
} from './use-replication-identity-ids';

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
};

function hostedSpacesQuery(
  hostIdentityWhere: PatchDbQueryWhereClause | null
): PatchDbQuery {
  if (hostIdentityWhere === null) {
    return { entityType: SPACE_ENTITY_TYPE, limit: 0 };
  }
  return {
    entityType: SPACE_ENTITY_TYPE,
    where: {
      type: 'and',
      clauses: [
        hostIdentityWhere,
        { type: 'not_exists', attribute: SpaceAttr.endedAt.key },
      ],
    },
    orderBy: [{ attribute: SpaceAttr.createdAt.key, direction: 'desc' }],
  };
}

function guestMembershipsQuery(
  guestIdentityWhere: PatchDbQueryWhereClause | null
): PatchDbQuery {
  if (guestIdentityWhere === null) {
    return { entityType: SPACE_MEMBERSHIP_ENTITY_TYPE, limit: 0 };
  }
  return {
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    where: {
      type: 'and',
      clauses: [
        guestIdentityWhere,
        { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt.key },
      ],
    },
  };
}

function guestSpacesQuery(guestSpaceIds: string[]): PatchDbQuery {
  if (guestSpaceIds.length === 0) {
    return { entityType: SPACE_ENTITY_TYPE, limit: 0 };
  }
  return { entityType: SPACE_ENTITY_TYPE, entityId: guestSpaceIds };
}

function guestSpaceIdsFromMemberships(memberships: Entity[]): string[] {
  const ids: string[] = [];
  for (const e of memberships) {
    const sid = SpaceMembershipAttr.spaceId.from(e.attributes);
    if (sid.length > 0) ids.push(sid);
  }
  return [...new Set(ids)].sort();
}

function buildCurrentSpaceEntries(
  hostedEntities: Entity[],
  guestSpaceIds: string[],
  guestSpaceEntities: Entity[]
): CurrentSpaceEntry[] {
  const bySpace = new Map<string, CurrentSpaceEntry>();
  for (const e of hostedEntities) {
    bySpace.set(e.entityId, { spaceId: e.entityId, role: 'host' });
  }
  const liveById = new Map<string, boolean>();
  for (const e of guestSpaceEntities) {
    const ended = e.attributes[SpaceAttr.endedAt.key];
    liveById.set(e.entityId, ended === undefined || ended === null);
  }
  for (const sid of guestSpaceIds) {
    if (bySpace.has(sid)) continue;
    const live = liveById.get(sid);
    if (live === false) continue;
    bySpace.set(sid, { spaceId: sid, role: 'guest' });
  }
  return [...bySpace.values()];
}

/**
 * The current user's live spaces — every space they host, plus every space
 * they have an active guest membership on (deduped, host wins).
 *
 * Genuinely multi-query: hosted spaces + guest memberships + follow-up lookup
 * for the live state of the guest-side spaces. Atoms downstream take only
 * `spaceId` / `role` from each entry.
 */
export function useCurrentSpaceIds(): {
  entries: CurrentSpaceEntry[];
  isLoading: boolean;
} {
  const identityIds = useReplicationIdentityIds();
  const hostIdentityWhere = hostIdMatchesIdentityWhere(identityIds);
  const guestIdentityWhere = guestIdMatchesIdentityWhere(identityIds);

  const hostedRes = useQuery(hostedSpacesQuery(hostIdentityWhere));
  const guestMemRes = useQuery(guestMembershipsQuery(guestIdentityWhere));

  const guestSpaceIds = useMemo(
    () => guestSpaceIdsFromMemberships(guestMemRes.entities),
    [guestMemRes.entities]
  );

  const guestSpacesRes = useQuery(guestSpacesQuery(guestSpaceIds));

  const entries = useMemo(
    () =>
      buildCurrentSpaceEntries(
        hostedRes.entities,
        guestSpaceIds,
        guestSpacesRes.entities
      ),
    [hostedRes.entities, guestSpaceIds, guestSpacesRes.entities]
  );

  return {
    entries,
    isLoading:
      hostedRes.isLoading || guestMemRes.isLoading || guestSpacesRes.isLoading,
  };
}
