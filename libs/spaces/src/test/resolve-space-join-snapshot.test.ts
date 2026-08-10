import { describe, expect, test } from 'bun:test';

import { resolveSpaceJoinSnapshot } from '../shared/join-space/resolve-space-join-snapshot';

const liveRow = {
  host_id: 'device-host',
  host_member_id: 'host-account',
  host_account_id: 'host-account',
  ended_at: null,
  visibility: 'public',
} as const;

describe('resolveSpaceJoinSnapshot', () => {
  test('disabled → unavailable', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: false,
        rowLoading: false,
        row: null,
        hasSpaceUser: false,
        viewerAccountId: 'viewer',
        viewerDeviceId: 'device',
      })
    ).toEqual({ status: 'unavailable', joinable: false });
  });

  test('loading without row → loading', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        rowLoading: true,
        row: null,
        hasSpaceUser: false,
        viewerAccountId: 'viewer',
        viewerDeviceId: 'device',
      })
    ).toEqual({ status: 'loading', joinable: false });
  });

  test('missing row after load → unavailable', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        rowLoading: false,
        row: null,
        hasSpaceUser: false,
        viewerAccountId: 'viewer',
        viewerDeviceId: 'device',
      })
    ).toEqual({ status: 'unavailable', joinable: false });
  });

  test('ended row → ended', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        rowLoading: false,
        row: { ...liveRow, ended_at: '2026-01-01T00:00:00.000Z' },
        hasSpaceUser: false,
        viewerAccountId: 'viewer',
        viewerDeviceId: 'device',
      })
    ).toEqual({ status: 'ended', joinable: false });
  });

  test('public live row is joinable when signed in', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        rowLoading: false,
        row: liveRow,
        hasSpaceUser: false,
        viewerAccountId: 'viewer',
        viewerDeviceId: 'device',
      })
    ).toEqual({ status: 'live', joinable: true });
  });

  test('private live row joinable only with spaces_users', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        rowLoading: false,
        row: { ...liveRow, visibility: 'private' },
        hasSpaceUser: false,
        viewerAccountId: 'viewer',
        viewerDeviceId: 'device',
      })
    ).toEqual({ status: 'live', joinable: false });
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        rowLoading: false,
        row: { ...liveRow, visibility: 'private' },
        hasSpaceUser: true,
        viewerAccountId: 'viewer',
        viewerDeviceId: 'device',
      })
    ).toEqual({ status: 'live', joinable: true });
  });
});
