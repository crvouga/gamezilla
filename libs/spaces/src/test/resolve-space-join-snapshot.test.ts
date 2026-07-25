import { describe, expect, test } from 'bun:test';

import { resolveSpaceJoinSnapshot } from '../shared/join-space/resolve-space-join-snapshot';
import { spaceJoinStreamParams } from '../shared/join-space/space-join-stream';

const livePublicRow = {
  host_id: 'host-device',
  host_member_id: 'host',
  host_account_id: 'host',
  ended_at: null,
  visibility: 'public',
} as const;

describe('resolveSpaceJoinSnapshot', () => {
  test('loading until stream ready when row is missing', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: false,
        rowLoading: false,
        row: null,
        hasValidInvite: false,
        isFriendOfHost: false,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'loading', joinable: false });

    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: true,
        rowLoading: true,
        row: null,
        hasValidInvite: false,
        isFriendOfHost: false,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'loading', joinable: false });
  });

  test('hydrated local row resolves without waiting for stream', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: false,
        rowLoading: false,
        row: livePublicRow,
        hasValidInvite: false,
        isFriendOfHost: false,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'live', joinable: true });

    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: false,
        rowLoading: false,
        row: { ...livePublicRow, ended_at: '2020-01-01T00:00:00.000Z' },
        hasValidInvite: false,
        isFriendOfHost: false,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'ended', joinable: false });
  });

  test('missing row after checkpoint is unavailable', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: true,
        rowLoading: false,
        row: null,
        hasValidInvite: false,
        isFriendOfHost: false,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'unavailable', joinable: false });
  });

  test('ended row is not joinable', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: true,
        rowLoading: false,
        row: { ...livePublicRow, ended_at: '2020-01-01T00:00:00.000Z' },
        hasValidInvite: true,
        isFriendOfHost: true,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'ended', joinable: false });
  });

  test('public live row is joinable for signed-in viewer', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: true,
        rowLoading: false,
        row: livePublicRow,
        hasValidInvite: false,
        isFriendOfHost: false,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'live', joinable: true });
  });

  test('public live row is not joinable when signed out', () => {
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: true,
        rowLoading: false,
        row: livePublicRow,
        hasValidInvite: false,
        isFriendOfHost: false,
        viewerAccountId: null,
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'live', joinable: false });
  });

  test('private live row requires valid invite', () => {
    const privateRow = { ...livePublicRow, visibility: 'private' };
    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: true,
        rowLoading: false,
        row: privateRow,
        hasValidInvite: false,
        isFriendOfHost: false,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'live', joinable: false });

    expect(
      resolveSpaceJoinSnapshot({
        enabled: true,
        streamReady: true,
        rowLoading: false,
        row: privateRow,
        hasValidInvite: true,
        isFriendOfHost: false,
        viewerAccountId: 'guest',
        viewerDeviceId: 'dev',
      })
    ).toEqual({ status: 'live', joinable: true });
  });
});

describe('spaceJoinStreamParams', () => {
  test('normalizes missing invite token to empty string', () => {
    expect(spaceJoinStreamParams({ spaceId: 's1' })).toEqual({
      space_id: 's1',
      invite_token: '',
    });
    expect(
      spaceJoinStreamParams({ spaceId: 's1', inviteToken: 'tok' })
    ).toEqual({
      space_id: 's1',
      invite_token: 'tok',
    });
  });
});
