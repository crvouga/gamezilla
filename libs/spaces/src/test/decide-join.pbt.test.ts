import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { canonicalUserPair } from '../shared/space/canonical-user-pair';
import { decideJoin } from '../shared/space/participation/space-participation-policy';
import { arbJoinDecisionInput } from './arbitraries/join-decision';
import { arbDistinctUserPair } from './arbitraries/user-pair';

describe('decideJoin properties', () => {
  test('host viewer is always allowed', () => {
    assertProperty(
      'host may always join',
      fc.property(arbJoinDecisionInput(), (base) => {
        const hostAccount = base.hostAccountId ?? base.hostMemberId;
        const decision = decideJoin({
          ...base,
          viewerAccountId: hostAccount,
          viewerMemberId: base.hostMemberId,
          viewerDeviceId: base.hostId,
        });
        expect(decision.allowed).toBe(true);
        if (decision.allowed) expect(decision.reason).toBe('host');
      })
    );
  });

  test('public visibility allows signed-in viewers', () => {
    assertProperty(
      'public ⇒ allowed',
      fc.property(arbJoinDecisionInput(), (base) => {
        const decision = decideJoin({ ...base, visibility: 'public' });
        expect(decision.allowed).toBe(true);
      })
    );
  });

  test('private without ACL/friend/host is denied', () => {
    assertProperty(
      'private stranger denied',
      fc.property(arbDistinctUserPair(), ([host, viewer]) => {
        const decision = decideJoin({
          visibility: 'private',
          hostId: 'host-device',
          hostAccountId: host,
          hostMemberId: host,
          viewerAccountId: viewer,
          viewerDeviceId: 'viewer-device',
          viewerMemberId: viewer,
          hasSpaceUser: false,
          isFriendOfHost: false,
        });
        expect(decision.allowed).toBe(false);
      })
    );
  });
});

describe('spaces canonicalUserPair', () => {
  test('is commutative', () => {
    assertProperty(
      'canonicalUserPair commutative',
      fc.property(arbDistinctUserPair(), ([a, b]) => {
        expect(canonicalUserPair(a, b)).toEqual(canonicalUserPair(b, a));
      })
    );
  });
});
