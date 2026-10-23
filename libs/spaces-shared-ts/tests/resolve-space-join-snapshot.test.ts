import { describe, expect, test } from 'bun:test';
import type { ResolveSpaceJoinSnapshotInput } from '@libs/spaces-shared-ts/resolve-space-join-snapshot';
import { resolveSpaceJoinSnapshot } from '@libs/spaces-shared-ts/resolve-space-join-snapshot';

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
    expect(snapshot).toEqual({ status: 'missing' });
  });

  test('a live space is still offered', () => {
    const snapshot = resolveSpaceJoinSnapshot(input(liveRow));
    expect(snapshot.status).toBe('live');
  });

  // regression: join-disabled-without-reason
  test('an open space the viewer may not join says so instead of offering Join', () => {
    const snapshot = resolveSpaceJoinSnapshot({
      ...input({
        ...liveRow,
        host_id: 'alice-device',
        host_member_id: 'alice',
        host_account_id: 'alice',
        visibility: 'private',
      }),
      hasSpaceUser: false,
      isFriendOfHost: false,
      viewerAccountId: 'bob',
      viewerMemberId: 'bob',
      viewerDeviceId: 'bob-device',
    });
    expect(snapshot).toEqual({ status: 'unavailable' });
  });
});
