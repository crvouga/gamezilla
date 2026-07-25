import { describe, expect, test } from 'bun:test';

import { decideSpaceJoinAccess } from '../shared/join-space/decide-space-join-access';

const base = {
  hostId: 'host-device',
  hostAccountId: 'host',
  hostMemberId: 'host',
  viewerDeviceId: 'guest-device',
} as const;

describe('decideSpaceJoinAccess', () => {
  test('private requires invite', () => {
    const denied = decideSpaceJoinAccess({
      ...base,
      visibility: 'private',
      viewerAccountId: 'guest',
      viewerMemberId: 'guest',
      isFriendOfHost: true,
      hasValidInvite: false,
    });
    expect(denied).toEqual({
      allowed: false,
      code: 'SPACE_VISIBILITY_DENIED',
    });

    const allowed = decideSpaceJoinAccess({
      ...base,
      visibility: 'private',
      viewerAccountId: 'guest',
      viewerMemberId: 'guest',
      isFriendOfHost: false,
      hasValidInvite: true,
    });
    expect(allowed).toEqual({ allowed: true, reason: 'invite' });
  });

  test('public allows signed-in viewers', () => {
    const allowed = decideSpaceJoinAccess({
      ...base,
      visibility: 'public',
      viewerAccountId: 'guest',
      viewerMemberId: 'guest',
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(allowed).toEqual({ allowed: true, reason: 'open' });

    const denied = decideSpaceJoinAccess({
      ...base,
      visibility: 'public',
      viewerAccountId: null,
      viewerMemberId: 'dev',
      viewerDeviceId: 'dev',
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(denied).toEqual({ allowed: false, code: 'SPACE_NOT_SIGNED_IN' });
  });

  test('friends requires friendship or invite', () => {
    const friendOk = decideSpaceJoinAccess({
      ...base,
      visibility: 'friends',
      viewerAccountId: 'guest',
      viewerMemberId: 'guest',
      isFriendOfHost: true,
      hasValidInvite: false,
    });
    expect(friendOk).toEqual({ allowed: true, reason: 'friend' });

    const stranger = decideSpaceJoinAccess({
      ...base,
      visibility: 'friends',
      viewerAccountId: 'guest',
      viewerMemberId: 'guest',
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(stranger).toEqual({
      allowed: false,
      code: 'SPACE_VISIBILITY_DENIED',
    });
  });

  test('host member may join from another device', () => {
    const result = decideSpaceJoinAccess({
      ...base,
      visibility: 'public',
      viewerAccountId: 'host',
      viewerMemberId: 'host',
      viewerDeviceId: 'host-device-2',
      isFriendOfHost: true,
      hasValidInvite: false,
      alreadyMember: true,
    });
    expect(result).toEqual({ allowed: true, reason: 'host' });
  });

  test('creating device may join private when member drifted', () => {
    const result = decideSpaceJoinAccess({
      visibility: 'private',
      hostId: 'dev-anon',
      hostAccountId: null,
      hostMemberId: 'dev-anon',
      viewerAccountId: 'acct',
      viewerDeviceId: 'dev-anon',
      viewerMemberId: 'acct',
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(result).toEqual({ allowed: true, reason: 'host' });
  });
});
