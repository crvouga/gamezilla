import { useMyId } from '@libs/auth/client/use-current-user';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { spaceGuestMembershipEntityId } from '../shared/membership-key';
import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '../shared/sync-tables';

export type SpacePresence =
  | { readonly status: 'loading' }
  | { readonly status: 'active'; readonly role: 'host' | 'guest' }
  | { readonly status: 'join'; readonly ended: boolean };

type SpaceRow = {
  readonly host_id: string | null;
  readonly ended_at: string | null;
};

type GuestMembershipRow = {
  readonly id: string;
};

function isActiveHost(
  spaceRow: SpaceRow | null,
  myId: string
): boolean {
  const hostId = spaceRow?.host_id ?? null;
  const endedAt = spaceRow?.ended_at ?? null;
  return (
    endedAt === null &&
    hostId !== null &&
    hostId.length > 0 &&
    hostId === myId
  );
}

function loadingPresence(args: {
  spaceEnabled: boolean;
  spaceLoading: boolean;
  memberEnabled: boolean;
  guestLoading: boolean;
}): SpacePresence | null {
  if (!args.spaceEnabled || args.spaceLoading) {
    return { status: 'loading' };
  }
  if (args.memberEnabled && args.guestLoading) {
    return { status: 'loading' };
  }
  return null;
}

function resolveSpacePresence(args: {
  readonly spaceEnabled: boolean;
  readonly spaceLoading: boolean;
  readonly memberEnabled: boolean;
  readonly guestLoading: boolean;
  readonly guestRow: GuestMembershipRow | null;
  readonly spaceRow: SpaceRow | null;
  readonly myId: string;
}): SpacePresence {
  const loading = loadingPresence(args);
  if (loading !== null) return loading;
  if (args.memberEnabled && args.guestRow !== null) {
    return { status: 'active', role: 'guest' };
  }
  if (args.memberEnabled && isActiveHost(args.spaceRow, args.myId)) {
    return { status: 'active', role: 'host' };
  }
  const endedAt = args.spaceRow?.ended_at ?? null;
  return { status: 'join', ended: endedAt !== null };
}

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

  return useMemo(
    () =>
      resolveSpacePresence({
        spaceEnabled,
        spaceLoading,
        memberEnabled,
        guestLoading,
        guestRow,
        spaceRow,
        myId,
      }),
    [
      spaceEnabled,
      spaceLoading,
      memberEnabled,
      guestLoading,
      guestRow,
      spaceRow,
      myId,
    ]
  );
}
