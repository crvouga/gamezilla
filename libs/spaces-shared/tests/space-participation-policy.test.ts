/**
 * Regression guards for identity drift. The general decision table lives in
 * `space-participation-policy.property.test.ts`; these pin the concrete
 * drift shapes that once locked a host out of their own space.
 */
import { describe, expect, test } from 'bun:test';

import { decideJoin, isSpaceHostActor } from '@libs/spaces-shared/space-participation-policy';

const base = {
  visibility: 'public' as const,
  hostId: 'host-device',
  hostAccountId: 'host-acct',
  hostMemberId: 'host-acct',
  viewerAccountId: 'guest-acct',
  viewerDeviceId: 'guest-device',
  viewerMemberId: 'guest-acct',
  hasSpaceUser: false,
  isFriendOfHost: false,
};

describe('host identity drift', () => {
  test('host account owns the space after its member id drifted to a device id', () => {
    expect(
      isSpaceHostActor({
        hostId: 'dev-1',
        hostMemberId: 'dev-1',
        hostAccountId: 'acct-1',
        memberId: 'acct-1',
        accountId: 'acct-1',
        deviceId: 'dev-2',
      })
    ).toBe(true);
  });

  test('creating device may join private space when member id drifted', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        hostId: 'dev-anon',
        hostMemberId: 'dev-anon',
        hostAccountId: null,
        viewerAccountId: 'host-acct',
        viewerMemberId: 'host-acct',
        viewerDeviceId: 'dev-anon',
      })
    ).toEqual({ allowed: true, reason: 'host' });
  });

  test('host account may join private space when member id drifted', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        hostId: 'other-device',
        hostMemberId: 'dev-anon',
        hostAccountId: 'host-acct',
        viewerAccountId: 'host-acct',
        viewerMemberId: 'host-acct',
        viewerDeviceId: 'host-device-2',
      })
    ).toEqual({ allowed: true, reason: 'host' });
  });
});
