import { describe, expect, test } from 'bun:test';

import { decideSpaceJoinAccess } from '../shared/join-space/decide-space-join-access';

const base = {
  hostId: 'device-host',
  hostAccountId: 'host-account',
  hostMemberId: 'host-account',
  viewerDeviceId: 'device-viewer',
  viewerMemberId: 'viewer-account',
} as const;

describe('decideSpaceJoinAccess', () => {
  test('public allows signed-in viewers', () => {
    expect(
      decideSpaceJoinAccess({
        ...base,
        visibility: 'public',
        viewerAccountId: 'viewer-account',
        hasSpaceUser: false,
      })
    ).toEqual({ allowed: true, reason: 'open' });
  });

  test('private requires spaces_users', () => {
    expect(
      decideSpaceJoinAccess({
        ...base,
        visibility: 'private',
        viewerAccountId: 'viewer-account',
        hasSpaceUser: true,
      })
    ).toEqual({ allowed: true, reason: 'already' });
    expect(
      decideSpaceJoinAccess({
        ...base,
        visibility: 'private',
        viewerAccountId: 'viewer-account',
        hasSpaceUser: false,
      })
    ).toEqual({ allowed: false, code: 'SPACE_VISIBILITY_DENIED' });
  });

  test('unsigned-in is denied', () => {
    expect(
      decideSpaceJoinAccess({
        ...base,
        visibility: 'public',
        viewerAccountId: null,
        hasSpaceUser: false,
      })
    ).toEqual({ allowed: false, code: 'SPACE_NOT_SIGNED_IN' });
  });

  test('host can always rejoin', () => {
    expect(
      decideSpaceJoinAccess({
        ...base,
        visibility: 'private',
        viewerAccountId: 'host-account',
        viewerMemberId: 'host-account',
        hasSpaceUser: false,
      })
    ).toEqual({ allowed: true, reason: 'host' });
  });

  test('existing space user can rejoin', () => {
    expect(
      decideSpaceJoinAccess({
        ...base,
        visibility: 'private',
        viewerAccountId: 'viewer-account',
        hasSpaceUser: true,
      })
    ).toEqual({ allowed: true, reason: 'already' });
  });
});
