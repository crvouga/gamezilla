import { parseSpaceVisibility } from '../space-visibility';
import { resolveSpaceMemberId } from '../participation/participation-ids';
import { decideSpaceJoinAccess } from './decide-space-join-access';

export type SpaceJoinSnapshotStatus =
  | 'loading'
  | 'live'
  | 'ended'
  | 'unavailable';

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
};

export type ResolveSpaceJoinSnapshotInput = {
  readonly enabled: boolean;
  readonly rowLoading: boolean;
  readonly row: SpaceJoinLocalRow | null;
  readonly isAllowlisted: boolean;
  readonly viewerAccountId: string | null;
  readonly viewerDeviceId: string;
};

function snapshotFromLiveRow(
  row: SpaceJoinLocalRow,
  input: ResolveSpaceJoinSnapshotInput
): SpaceJoinSnapshot {
  if (input.viewerAccountId === null || input.viewerAccountId.length === 0) {
    return { status: 'live', joinable: false };
  }
  const hostId = row.host_id ?? '';
  const hostMemberId = row.host_member_id ?? row.host_account_id ?? hostId;
  const viewerAccountId = input.viewerAccountId;
  const decision = decideSpaceJoinAccess({
    visibility: parseSpaceVisibility(row.visibility ?? 'private'),
    hostId,
    hostAccountId: row.host_account_id,
    hostMemberId,
    viewerAccountId,
    viewerDeviceId: input.viewerDeviceId,
    viewerMemberId: resolveSpaceMemberId(viewerAccountId),
    isAllowlisted: input.isAllowlisted,
    alreadyMember: false,
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
 * Derives join-screen status from local SQLite. Private spaces only appear
 * after the host adds the viewer to the allow list (auto-subscribe).
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
  if (input.row !== null) {
    return snapshotFromResolvedRow(input.row, input);
  }
  return { status: 'unavailable', joinable: false };
}
