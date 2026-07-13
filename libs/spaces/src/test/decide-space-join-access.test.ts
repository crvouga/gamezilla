import { describe, expect, test } from 'bun:test';

import { decideSpaceJoinAccess } from '../shared/decide-space-join-access';

describe('decideSpaceJoinAccess', () => {
  test('private requires invite', () => {
    const denied = decideSpaceJoinAccess({
      visibility: 'private',
      hostAccountId: 'host',
      viewerAccountId: 'guest',
      viewerIsHostDevice: false,
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
      viewerAccountId: 'guest',
      viewerIsHostDevice: false,
      isFriendOfHost: false,
      hasValidInvite: true,
    });
    expect(allowed).toEqual({ allowed: true, reason: 'invite' });
  });

  test('public allows signed-in viewers', () => {
    const allowed = decideSpaceJoinAccess({
      visibility: 'public',
      hostAccountId: 'host',
      viewerAccountId: 'guest',
      viewerIsHostDevice: false,
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(allowed).toEqual({ allowed: true, reason: 'open' });

    const denied = decideSpaceJoinAccess({
      visibility: 'public',
      hostAccountId: 'host',
      viewerAccountId: null,
      viewerIsHostDevice: false,
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(denied).toEqual({ allowed: false, code: 'SPACE_NOT_SIGNED_IN' });
  });

  test('friends requires friendship or invite', () => {
    const friendOk = decideSpaceJoinAccess({
      visibility: 'friends',
      hostAccountId: 'host',
      viewerAccountId: 'guest',
      viewerIsHostDevice: false,
      isFriendOfHost: true,
      hasValidInvite: false,
    });
    expect(friendOk).toEqual({ allowed: true, reason: 'friend' });

    const stranger = decideSpaceJoinAccess({
      visibility: 'friends',
      hostAccountId: 'host',
      viewerAccountId: 'guest',
      viewerIsHostDevice: false,
      isFriendOfHost: false,
      hasValidInvite: false,
    });
    expect(stranger).toEqual({
      allowed: false,
      code: 'SPACE_VISIBILITY_DENIED',
    });
  });

  test('host device cannot join', () => {
    const result = decideSpaceJoinAccess({
      visibility: 'public',
      hostAccountId: 'host',
      viewerAccountId: 'host',
      viewerIsHostDevice: true,
      isFriendOfHost: true,
      hasValidInvite: false,
    });
    expect(result).toEqual({
      allowed: false,
      code: 'SPACE_HOST_ALREADY_MEMBER',
    });
  });
});
