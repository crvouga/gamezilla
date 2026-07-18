import { describe, expect, test } from 'bun:test';

import { decideSpaceJoinAccess } from '../shared/join-space/decide-space-join-access';

describe('decideSpaceJoinAccess', () => {
  test('private requires invite', () => {
    const denied = decideSpaceJoinAccess({
      visibility: 'private',
      hostAccountId: 'host',
      hostMemberId: 'host',
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
      visibility: 'private',
      hostAccountId: 'host',
      hostMemberId: 'host',
      viewerAccountId: 'guest',
      viewerMemberId: 'guest',
      isFriendOfHost: false,
      hasValidInvite: true,
    });
    expect(allowed).toEqual({ allowed: true, reason: 'invite' });
  });

  test('public allows signed-in viewers', () => {
    const allowed = decideSpaceJoinAccess({
      visibility: 'public',
      hostAccountId: 'host',
      hostMemberId: 'host',
      viewerAccountId: 'guest',
      viewerMemberId: 'guest',
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(allowed).toEqual({ allowed: true, reason: 'open' });

    const denied = decideSpaceJoinAccess({
      visibility: 'public',
      hostAccountId: 'host',
      hostMemberId: 'host',
      viewerAccountId: null,
      viewerMemberId: 'dev',
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(denied).toEqual({ allowed: false, code: 'SPACE_NOT_SIGNED_IN' });
  });

  test('friends requires friendship or invite', () => {
    const friendOk = decideSpaceJoinAccess({
      visibility: 'friends',
      hostAccountId: 'host',
      hostMemberId: 'host',
      viewerAccountId: 'guest',
      viewerMemberId: 'guest',
      isFriendOfHost: true,
      hasValidInvite: false,
    });
    expect(friendOk).toEqual({ allowed: true, reason: 'friend' });

    const stranger = decideSpaceJoinAccess({
      visibility: 'friends',
      hostAccountId: 'host',
      hostMemberId: 'host',
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
      visibility: 'public',
      hostAccountId: 'host',
      hostMemberId: 'host',
      viewerAccountId: 'host',
      viewerMemberId: 'host',
      isFriendOfHost: true,
      hasValidInvite: false,
      alreadyMember: true,
      alreadyParticipating: false,
    });
    expect(result).toEqual({ allowed: true, reason: 'host' });
  });
});
