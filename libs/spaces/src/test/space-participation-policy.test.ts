import { describe, expect, test } from 'bun:test';

import {
  collapseRoster,
  decideEndSpace,
  decideJoin,
  decideLeaveDevice,
  decideLeaveEverywhere,
  isHostMember,
  isSpaceHostActor,
  resolveMemberId,
  resolvePresenceRole,
  resolveRoomActorId,
  shouldBumpMemberCountOnJoin,
  shouldConsumeInviteOnJoin,
} from '../shared/participation/space-participation-policy';
import {
  spaceMembershipEntityId,
  spaceParticipationEntityId,
} from '../shared/participation/participation-ids';

describe('resolveMemberId', () => {
  test('prefers account when signed in', () => {
    expect(resolveMemberId({ accountId: 'acct-1', deviceId: 'dev-1' })).toBe(
      'acct-1'
    );
  });

  test('falls back to device for anon', () => {
    expect(resolveMemberId({ accountId: null, deviceId: 'dev-1' })).toBe(
      'dev-1'
    );
  });
});

describe('ids', () => {
  test('membership and participation keys', () => {
    expect(spaceMembershipEntityId('acct-1', 'space-1')).toBe('acct-1:space-1');
    expect(spaceParticipationEntityId('dev-1', 'space-1')).toBe(
      'dev-1:space-1'
    );
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
    expect(resolveRoomActorId({ accountId: 'acct-1', deviceId: 'dev-1' })).toBe(
      'acct-1'
    );
    expect(resolveRoomActorId({ accountId: null, deviceId: 'dev-1' })).toBe(
      'dev-1'
    );
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
    isFriendOfHost: false,
    hasValidInvite: false,
    alreadyMember: false,
    alreadyParticipating: false,
  };

  test('allows public signed-in join', () => {
    expect(decideJoin(base)).toEqual({ allowed: true, reason: 'open' });
  });

  test('denies public anon without invite', () => {
    expect(
      decideJoin({
        ...base,
        viewerAccountId: null,
        viewerMemberId: 'dev-anon',
        viewerDeviceId: 'dev-anon',
      })
    ).toEqual({ allowed: false, code: 'SPACE_NOT_SIGNED_IN' });
  });

  test('host second device is allowed', () => {
    expect(
      decideJoin({
        ...base,
        viewerAccountId: 'host-acct',
        viewerMemberId: 'host-acct',
        viewerDeviceId: 'host-device-2',
        alreadyMember: true,
        alreadyParticipating: false,
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

  test('idempotent when already participating', () => {
    expect(decideJoin({ ...base, alreadyParticipating: true })).toEqual({
      allowed: true,
      reason: 'already',
    });
  });

  test('member adding another device without re-checking visibility', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        alreadyMember: true,
        hasValidInvite: false,
      })
    ).toEqual({ allowed: true, reason: 'already' });
  });

  test('private requires invite for new members', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        hasValidInvite: false,
      })
    ).toEqual({ allowed: false, code: 'SPACE_VISIBILITY_DENIED' });
    expect(
      decideJoin({
        ...base,
        visibility: 'private',
        hasValidInvite: true,
      })
    ).toEqual({ allowed: true, reason: 'invite' });
  });

  test('friends visibility', () => {
    expect(
      decideJoin({
        ...base,
        visibility: 'friends',
        isFriendOfHost: true,
      })
    ).toEqual({ allowed: true, reason: 'friend' });
    expect(
      decideJoin({
        ...base,
        visibility: 'friends',
        isFriendOfHost: false,
      })
    ).toEqual({ allowed: false, code: 'SPACE_VISIBILITY_DENIED' });
  });
});

describe('decideLeaveDevice / decideLeaveEverywhere', () => {
  test('last device also leaves membership', () => {
    expect(decideLeaveDevice({ hasOtherActiveParticipations: false })).toEqual({
      leaveParticipation: true,
      leaveMembership: true,
    });
  });

  test('other devices keep membership', () => {
    expect(decideLeaveDevice({ hasOtherActiveParticipations: true })).toEqual({
      leaveParticipation: true,
      leaveMembership: false,
    });
  });

  test('leave everywhere clears all', () => {
    expect(decideLeaveEverywhere()).toEqual({
      leaveAllParticipations: true,
      leaveMembership: true,
    });
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

describe('collapseRoster', () => {
  test('unique members with device lists', () => {
    expect(
      collapseRoster([
        { memberId: 'a', deviceId: 'd1', leftAt: null },
        { memberId: 'a', deviceId: 'd2', leftAt: null },
        { memberId: 'b', deviceId: 'd3', leftAt: null },
        { memberId: 'c', deviceId: 'd4', leftAt: '2020-01-01' },
      ])
    ).toEqual([
      { memberId: 'a', deviceIds: ['d1', 'd2'] },
      { memberId: 'b', deviceIds: ['d3'] },
    ]);
  });
});

describe('invite / count helpers', () => {
  test('consume invite only on membership reactivation', () => {
    expect(
      shouldConsumeInviteOnJoin({
        membershipWasInactive: true,
        hasInviteToken: true,
      })
    ).toBe(true);
    expect(
      shouldConsumeInviteOnJoin({
        membershipWasInactive: false,
        hasInviteToken: true,
      })
    ).toBe(false);
  });

  test('bump count only on membership reactivation', () => {
    expect(shouldBumpMemberCountOnJoin({ membershipWasInactive: true })).toBe(
      true
    );
    expect(shouldBumpMemberCountOnJoin({ membershipWasInactive: false })).toBe(
      false
    );
  });
});
