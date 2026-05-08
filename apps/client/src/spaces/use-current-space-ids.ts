import { useMyId } from '@gamezilla/client/auth/auth-context';
import { parseStringAttr } from '@gamezilla/client/spaces/space-parsers';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQuery } from '@gamezilla/patch-db/react';
import { useMemo } from 'react';

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
};

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
  const myId = useMyId();
  const hostedRes = useQuery({
    entityType: SPACE_ENTITY_TYPE,
    where: {
      type: 'and',
      clauses: [
        { type: '=', attribute: SpaceAttr.hostId, value: myId },
        { type: 'not_exists', attribute: SpaceAttr.endedAt },
      ],
    },
    orderBy: [{ attribute: SpaceAttr.createdAt, direction: 'desc' }],
  });

  const guestMemRes = useQuery({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    where: {
      type: 'and',
      clauses: [
        { type: '=', attribute: SpaceMembershipAttr.guestId, value: myId },
        { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt },
      ],
    },
  });

  const guestSpaceIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of guestMemRes.entities) {
      const sid = parseStringAttr(
        e.attributes[SpaceMembershipAttr.spaceId]
      );
      if (sid !== null) ids.push(sid);
    }
    return [...new Set(ids)].sort();
  }, [guestMemRes.entities]);

  const guestSpacesRes = useQuery(
    guestSpaceIds.length === 0
      ? { entityType: SPACE_ENTITY_TYPE, limit: 0 }
      : { entityType: SPACE_ENTITY_TYPE, entityId: guestSpaceIds }
  );

  const entries = useMemo<CurrentSpaceEntry[]>(() => {
    const bySpace = new Map<string, CurrentSpaceEntry>();
    for (const e of hostedRes.entities) {
      bySpace.set(e.entityId, { spaceId: e.entityId, role: 'host' });
    }
    const liveById = new Map<string, boolean>();
    for (const e of guestSpacesRes.entities) {
      const ended = e.attributes[SpaceAttr.endedAt];
      liveById.set(e.entityId, ended === undefined || ended === null);
    }
    for (const sid of guestSpaceIds) {
      if (bySpace.has(sid)) continue;
      const live = liveById.get(sid);
      if (live === false) continue;
      bySpace.set(sid, { spaceId: sid, role: 'guest' });
    }
    return [...bySpace.values()];
  }, [hostedRes.entities, guestSpaceIds, guestSpacesRes.entities]);

  return {
    entries,
    isLoading:
      hostedRes.isLoading || guestMemRes.isLoading || guestSpacesRes.isLoading,
  };
}
