import { describe, expect, test } from 'bun:test';

import { decideJoin } from '@libs/spaces-shared-ts/space-participation-policy';

const base = {
  visibility: 'public' as const,
  hostId: 'host-device',
  hostAccountId: null,
  hostMemberId: 'host-member',
  viewerAccountId: null,
  viewerDeviceId: 'guest-device',
  viewerMemberId: 'guest-member',
  hasSpaceUser: false,
  isFriendOfHost: false,
};

describe('guest space join access', () => {
  test('a guest with the link may open a public space', () => {
    expect(decideJoin(base)).toEqual({ allowed: true, reason: 'open' });
  });

  test('a guest with an ACL row may reopen a private space', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        hasSpaceUser: true,
      })
    ).toEqual({ allowed: true, reason: 'already' });
  });

  test('a guest host may reopen their own private space', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        viewerDeviceId: 'host-device',
        viewerMemberId: 'host-member',
      })
    ).toEqual({ allowed: true, reason: 'host' });
  });

  test('a guest without ACL is refused a private space', () => {
    expect(decideJoin({ ...base, visibility: 'private' })).toEqual({
      allowed: false,
      code: 'SPACE_VISIBILITY_DENIED',
    });
  });
});
