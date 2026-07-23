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
  readonly streamReady: boolean;
  readonly rowLoading: boolean;
  readonly row: SpaceJoinLocalRow | null;
  readonly hasValidInvite: boolean;
  readonly isFriendOfHost: boolean;
  readonly viewerAccountId: string | null;
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
    viewerMemberId: resolveSpaceMemberId({
      accountId: input.viewerAccountId,
      deviceId: input.viewerDeviceId,
    }),
    isFriendOfHost: input.isFriendOfHost,
    hasValidInvite: input.hasValidInvite,
  });
  return { status: 'live', joinable: decision.allowed };
}

/**
 * Derives join-screen status from local SQLite + stream readiness.
 * Stream must finish its first checkpoint before a missing row means unavailable.
 */
export function resolveSpaceJoinSnapshot(
  input: ResolveSpaceJoinSnapshotInput
): SpaceJoinSnapshot {
  if (!input.enabled) {
    return { status: 'unavailable', joinable: false };
  }
  if (!input.streamReady || input.rowLoading) {
    return { status: 'loading', joinable: false };
  }
  const row = input.row;
  if (row === null || row.host_id === null || row.host_id.length === 0) {
    return { status: 'unavailable', joinable: false };
  }
  if (row.ended_at !== null) {
    return { status: 'ended', joinable: false };
  }
  return snapshotFromLiveRow(row, input);
}
