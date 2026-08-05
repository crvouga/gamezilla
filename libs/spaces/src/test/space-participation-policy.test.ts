import { describe, expect, test } from 'bun:test';

import {
  decideEndSpace,
  decideJoin,
  isHostMember,
  isSpaceHostActor,
  resolveMemberId,
  resolvePresenceRole,
  resolveRoomActorId,
} from '../shared/participation/space-participation-policy';

describe('resolveMemberId', () => {
  test('returns account id', () => {
    expect(resolveMemberId('acct-1')).toBe('acct-1');
  });
});

describe('isHostMember / presence / room actor', () => {
  test('host member equality', () => {
    expect(isHostMember({ hostMemberId: 'acct-1', memberId: 'acct-1' })).toBe(
      true
    );
    expect(isHostMember({ hostMemberId: 'acct-1', memberId: 'acct-2' })).toBe(
      false
    );
  });

  test('isSpaceHostActor covers device and account ownership', () => {
    expect(
      isSpaceHostActor({
        hostId: 'dev-1',
        hostMemberId: 'acct-1',
        hostAccountId: 'acct-1',
        memberId: 'acct-1',
        accountId: 'acct-1',
        deviceId: 'dev-2',
      })
    ).toBe(true);
    expect(
      isSpaceHostActor({
        hostId: 'dev-1',
        hostMemberId: 'dev-1',
        hostAccountId: null,
        memberId: 'acct-1',
        accountId: 'acct-1',
        deviceId: 'dev-1',
      })
    ).toBe(true);
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
    expect(
      isSpaceHostActor({
        hostId: 'dev-1',
        hostMemberId: 'dev-1',
        hostAccountId: null,
        memberId: 'acct-2',
        accountId: 'acct-2',
        deviceId: 'dev-2',
      })
    ).toBe(false);
  });

  test('presence role', () => {
    expect(resolvePresenceRole({ hostMemberId: 'h', memberId: 'h' })).toBe(
      'host'
    );
    expect(resolvePresenceRole({ hostMemberId: 'h', memberId: 'g' })).toBe(
      'guest'
    );
  });

  test('room actor is member id', () => {
    expect(resolveRoomActorId('acct-1')).toBe('acct-1');
  });
});

describe('decideJoin', () => {
  const base = {
    visibility: 'public' as const,
    hostId: 'host-device',
    hostAccountId: 'host-acct',
    hostMemberId: 'host-acct',
    viewerAccountId: 'guest-acct',
    viewerDeviceId: 'guest-device',
    viewerMemberId: 'guest-acct',
    hasSpaceUser: false,
  };

  test('allows public signed-in join', () => {
    expect(decideJoin(base)).toEqual({ allowed: true, reason: 'open' });
  });

  test('host second device is allowed', () => {
    expect(
      decideJoin({
        ...base,
        viewerAccountId: 'host-acct',
        viewerMemberId: 'host-acct',
        viewerDeviceId: 'host-device-2',
        hasSpaceUser: true,
      })
    ).toEqual({ allowed: true, reason: 'host' });
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

  test('idempotent when already a space user', () => {
    expect(decideJoin({ ...base, hasSpaceUser: true })).toEqual({
      allowed: true,
      reason: 'already',
    });
  });

  test('space user rejoin without re-checking visibility', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        hasSpaceUser: true,
      })
    ).toEqual({ allowed: true, reason: 'already' });
  });

  test('private requires space_users for new members', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        hasSpaceUser: false,
      })
    ).toEqual({ allowed: false, code: 'SPACE_VISIBILITY_DENIED' });
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        hasSpaceUser: true,
      })
    ).toEqual({ allowed: true, reason: 'already' });
  });
});

describe('decideEndSpace', () => {
  test('only host may end', () => {
    expect(decideEndSpace({ isHostActor: true })).toEqual({ allowed: true });
    expect(decideEndSpace({ isHostActor: false })).toEqual({
      allowed: false,
      code: 'SPACE_HOST_REQUIRED',
    });
  });
});
