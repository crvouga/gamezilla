import { describe, expect, test } from 'bun:test';
import {
  type ResolveSpaceJoinSnapshotInput,
  resolveSpaceJoinSnapshot,
} from '@libs/spaces/public/resolve-space-join-snapshot';

function input(
  row: ResolveSpaceJoinSnapshotInput['row']
): ResolveSpaceJoinSnapshotInput {
  return {
    enabled: true,
    rowLoading: false,
    row,
    linkAnswered: true,
    online: true,
    hasSpaceUser: true,
    isFriendOfHost: false,
    viewerAccountId: 'account',
    viewerMemberId: 'account',
    viewerDeviceId: 'device',
  };
}

const liveRow = {
  host_id: 'device',
  host_member_id: 'account',
  host_account_id: 'account',
  ended_at: null,
  visibility: 'public',
  deleted_at: null,
} as const;

describe('resolveSpaceJoinSnapshot', () => {
  // regression: journey-host-dumped-onto-own-live-space
  test('a tombstoned space is not offered as a live space to join', () => {
    const snapshot = resolveSpaceJoinSnapshot(
      input({ ...liveRow, deleted_at: '2026-09-29T23:00:00.000Z' })
    );
    expect(snapshot).toEqual({ status: 'missing', joinable: false });
  });

  test('a live space is still offered', () => {
    const snapshot = resolveSpaceJoinSnapshot(input(liveRow));
    expect(snapshot.status).toBe('live');
  });
});
