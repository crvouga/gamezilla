/**
 * `decideJoin` as a decision table: every input maps to exactly one row of
 * (host actor, ACL row, visibility, friendship). The oracle is written as
 * that table, independently of the policy's control flow, and ids are drawn
 * from a tiny pool (with `''`) so identity collisions and empty-id edge cases
 * are common.
 */
import { describe, expect, test } from 'bun:test';

import {
  decideJoin,
  isHostMember,
  isSpaceHostActor,
  resolveMemberId,
  resolvePresenceRole,
  resolveRoomActorId,
  type SpaceAccessDecision,
  type SpaceAccessInput,
} from '@libs/spaces/public/participation/space-participation-policy';
import { assertProperty, fc } from '@pkgs/property';

const arbId = fc.constantFrom('', 'a', 'b', 'c');
const arbAccountId = fc.option(arbId, { nil: null });

const arbInput: fc.Arbitrary<SpaceAccessInput> = fc.record({
  visibility: fc.constantFrom('public' as const, 'private' as const),
  hostId: arbId,
  hostAccountId: arbAccountId,
  hostMemberId: arbId,
  viewerAccountId: arbAccountId,
  viewerDeviceId: arbId,
  viewerMemberId: arbId,
  hasSpaceUser: fc.boolean(),
  isFriendOfHost: fc.boolean(),
});

/** Same id, and a real one: an empty or missing id never proves identity. */
function sameIdentity(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a !== '' && a === b;
}

function isHostOracle(input: SpaceAccessInput): boolean {
  return (
    sameIdentity(input.hostMemberId, input.viewerMemberId) ||
    sameIdentity(input.hostId, input.viewerDeviceId) ||
    sameIdentity(input.hostAccountId, input.viewerAccountId)
  );
}

type Row = readonly [
  host: boolean,
  acl: boolean,
  visibility: SpaceAccessInput['visibility'],
  friend: boolean,
];

/** A table row's condition: one cell per `Row` column, `null` is "any". */
type Pattern = readonly [
  host: boolean | null,
  acl: boolean | null,
  visibility: SpaceAccessInput['visibility'] | null,
  friend: boolean | null,
];

/** The decision table, first matching row wins. */
const TABLE: readonly (readonly [Pattern, SpaceAccessDecision])[] = [
  [[true, null, null, null], { allowed: true, reason: 'host' }],
  [[false, true, null, null], { allowed: true, reason: 'already' }],
  [[false, false, 'public', null], { allowed: true, reason: 'open' }],
  [[false, false, 'private', true], { allowed: true, reason: 'friend' }],
  [
    [false, false, 'private', false],
    { allowed: false, code: 'SPACE_VISIBILITY_DENIED' },
  ],
];

function oracle(input: SpaceAccessInput): SpaceAccessDecision {
  const row: Row = [
    isHostOracle(input),
    input.hasSpaceUser,
    input.visibility,
    input.isFriendOfHost,
  ];
  const hit = TABLE.find(([pattern]) =>
    pattern.every((cell, i) => cell === null || cell === row[i])
  );
  if (hit === undefined) throw new Error(`no table row for ${String(row)}`);
  return hit[1];
}

describe('decideJoin', () => {
  test('matches the decision table', () => {
    assertProperty(
      'decideJoin = table',
      fc.property(arbInput, (input) => {
        expect(decideJoin(input)).toEqual(oracle(input));
      })
    );
  });

  test('the host is always allowed, whatever the space', () => {
    assertProperty(
      'host always allowed',
      fc.property(arbInput, (input) => {
        const asHostDevice = { ...input, viewerDeviceId: 'host-device' };
        const decision = decideJoin({ ...asHostDevice, hostId: 'host-device' });
        expect(decision).toEqual({ allowed: true, reason: 'host' });
      })
    );
  });

  test('granting an ACL row, friendship or public visibility never revokes access', () => {
    assertProperty(
      'access is monotone in grants',
      fc.property(
        arbInput,
        fc.constantFrom('acl', 'friend', 'public'),
        (input, grant) => {
          const widened: SpaceAccessInput =
            grant === 'acl'
              ? { ...input, hasSpaceUser: true }
              : grant === 'friend'
                ? { ...input, isFriendOfHost: true }
                : { ...input, visibility: 'public' };
          if (decideJoin(input).allowed) {
            expect(decideJoin(widened).allowed).toBe(true);
          }
        }
      )
    );
  });

  test('a denial is only ever the visibility code', () => {
    assertProperty(
      'denial code',
      fc.property(arbInput, (input) => {
        const decision = decideJoin(input);
        if (!decision.allowed) {
          expect(decision.code).toBe('SPACE_VISIBILITY_DENIED');
          expect(input.visibility).toBe('private');
        }
      })
    );
  });
});

describe('host identity helpers', () => {
  test('isHostMember is non-empty equality and symmetric', () => {
    assertProperty(
      'isHostMember',
      fc.property(arbId, arbId, (hostMemberId, memberId) => {
        const result = isHostMember({ hostMemberId, memberId });
        expect(result).toBe(sameIdentity(hostMemberId, memberId));
        expect(
          isHostMember({ hostMemberId: memberId, memberId: hostMemberId })
        ).toBe(result);
      })
    );
  });

  test('presence role is host exactly when isHostMember', () => {
    assertProperty(
      'presence role',
      fc.property(arbId, arbId, (hostMemberId, memberId) => {
        const args = { hostMemberId, memberId };
        expect(resolvePresenceRole(args)).toBe(
          isHostMember(args) ? 'host' : 'guest'
        );
      })
    );
  });

  test('a host member is always a host actor', () => {
    assertProperty(
      'isHostMember => isSpaceHostActor',
      fc.property(arbInput, (input) => {
        const args = {
          hostId: input.hostId,
          hostMemberId: input.hostMemberId,
          hostAccountId: input.hostAccountId,
          memberId: input.viewerMemberId,
          accountId: input.viewerAccountId,
          deviceId: input.viewerDeviceId,
        };
        expect(isSpaceHostActor(args)).toBe(isHostOracle(input));
        if (isHostMember(args)) expect(isSpaceHostActor(args)).toBe(true);
      })
    );
  });

  test('member and room actor ids are the account id', () => {
    assertProperty(
      'member id identity',
      fc.property(fc.string(), (accountId) => {
        expect(resolveMemberId(accountId)).toBe(accountId);
        expect(resolveRoomActorId(accountId)).toBe(accountId);
      })
    );
  });
});
