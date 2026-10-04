import { decideSpaceJoinAccess } from './decide-space-join-access';
import { parseSpaceVisibility } from './space-visibility';

export type SpaceJoinSnapshotStatus =
  | 'loading'
  | 'live'
  | 'ended'
  | 'unavailable'
  /** The server answered for the link and there is no such space. */
  | 'missing'
  /** Not on this device and the server cannot be reached to ask. */
  | 'offline';

export type SpaceJoinSnapshot = {
  readonly status: SpaceJoinSnapshotStatus;
  readonly joinable: boolean;
};

export type SpaceJoinLocalRow = {
  readonly host_id: string | null;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly visibility: string | null;
  /** Set when the row is a tombstone. A tombstone is not a live space. */
  readonly deleted_at?: string | null;
};

export type ResolveSpaceJoinSnapshotInput = {
  readonly enabled: boolean;
  readonly rowLoading: boolean;
  readonly row: SpaceJoinLocalRow | null;
  /** The server has answered the link's query (see `useSpaceByLink`). */
  readonly linkAnswered: boolean;
  readonly online: boolean;
  readonly hasSpaceUser: boolean;
  readonly isFriendOfHost: boolean;
  readonly viewerAccountId: string | null;
  readonly viewerMemberId: string;
  readonly viewerDeviceId: string;
};

function snapshotFromLiveRow(
  row: SpaceJoinLocalRow,
  input: ResolveSpaceJoinSnapshotInput
): SpaceJoinSnapshot {
  const hostId = row.host_id ?? '';
  const hostMemberId = row.host_member_id ?? row.host_account_id ?? hostId;
  const decision = decideSpaceJoinAccess({
    visibility: parseSpaceVisibility(row.visibility ?? 'private'),
    hostId,
    hostAccountId: row.host_account_id,
    hostMemberId,
    viewerAccountId: input.viewerAccountId,
    viewerDeviceId: input.viewerDeviceId,
    viewerMemberId: input.viewerMemberId,
    hasSpaceUser: input.hasSpaceUser,
    isFriendOfHost: input.isFriendOfHost,
  });
  return { status: 'live', joinable: decision.allowed };
}

function snapshotFromResolvedRow(
  row: SpaceJoinLocalRow,
  input: ResolveSpaceJoinSnapshotInput
): SpaceJoinSnapshot {
  if (row.host_id === null || row.host_id.length === 0) {
    return { status: 'unavailable', joinable: false };
  }
  if (row.ended_at !== null) {
    return { status: 'ended', joinable: false };
  }
  return snapshotFromLiveRow(row, input);
}

/**
 * Derives join-screen status from local SQLite. Private spaces appear for
 * hosts, ACL members, and friends of the host. With no row, the link's
 * answer decides: the server said there is none (`missing`), it cannot be
 * asked (`offline`), or it has not answered yet (`loading`).
 */
export function resolveSpaceJoinSnapshot(
  input: ResolveSpaceJoinSnapshotInput
): SpaceJoinSnapshot {
  if (!input.enabled) {
    return { status: 'unavailable', joinable: false };
  }
  if (input.rowLoading) {
    return { status: 'loading', joinable: false };
  }
  const row = input.row;
  const tombstoned =
    row !== null && row.deleted_at != null && row.deleted_at.length > 0;
  if (row !== null && !tombstoned) {
    return snapshotFromResolvedRow(row, input);
  }
  if (input.linkAnswered) return { status: 'missing', joinable: false };
  if (!input.online) return { status: 'offline', joinable: false };
  return { status: 'loading', joinable: false };
}
