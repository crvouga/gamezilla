import { useMyId } from '@libs/auth/client/use-current-user';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useRef } from 'react';

import { spaceGuestMembershipEntityId } from '../shared/membership-key';
import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import {
  latchStaleSpacePresence,
  resolveSpacePresence,
  type SpacePresence,
} from '../shared/resolve-space-presence';

export type { SpacePresence };

type SpaceRow = {
  readonly host_id: string | null;
  readonly ended_at: string | null;
};

type GuestMembershipRow = {
  readonly id: string;
};

/**
 * Resolves whether the current user is in `spaceId` using targeted sync
 * queries for that space only (not the global membership list).
 */
export function useSpacePresence(spaceId: string): SpacePresence {
  const myId = useMyId();
  const spaceEnabled = spaceId.length > 0;
  const memberEnabled = spaceEnabled && myId.length > 0;

  const { row: spaceRow, isLoading: spaceLoading } = useWatchOne<SpaceRow>(
    spaceEnabled
      ? `SELECT ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at
         FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.id} = ?`
      : `SELECT ${SpaceCol.hostId} AS host_id, ${SpaceCol.endedAt} AS ended_at FROM ${SPACES_TABLE.tableName} WHERE 0`,
    spaceEnabled ? [spaceId] : []
  );

  const membershipId = memberEnabled
    ? spaceGuestMembershipEntityId(myId, spaceId)
    : '';

  const { row: guestRow, isLoading: guestLoading } =
    useWatchOne<GuestMembershipRow>(
      memberEnabled
        ? `SELECT ${SpaceMembershipCol.id} AS id
           FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
           WHERE ${SpaceMembershipCol.id} = ? AND ${SpaceMembershipCol.leftAt} IS NULL`
        : `SELECT ${SpaceMembershipCol.id} AS id FROM ${SPACE_MEMBERSHIPS_TABLE.tableName} WHERE 0`,
      memberEnabled ? [membershipId] : []
    );

  const latchRef = useRef<{
    spaceId: string;
    presence: SpacePresence;
  } | null>(null);

  const resolved = resolveSpacePresence({
    spaceEnabled,
    spaceLoading,
    spaceRow,
    memberEnabled,
    guestLoading,
    guestRow,
    myId,
  });

  const latched = latchStaleSpacePresence(spaceId, resolved, latchRef.current);
  latchRef.current = latched.latch;
  return latched.presence;
}
