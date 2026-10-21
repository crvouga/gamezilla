import { describe, expect, test } from 'bun:test';
import type { RoleId } from '@pkgs/permissions-shared-ts/catalog';
import { defineCatalog } from '@pkgs/permissions-shared-ts/catalog';
import { can, checkLimit } from '@pkgs/permissions-shared-ts/evaluate';
import type { PermissionPolicy } from '@pkgs/permissions-shared-ts/policy';
import { definePolicy } from '@pkgs/permissions-shared-ts/policy';
import { permissionsOf } from '@pkgs/permissions-shared-ts/resolve';
import { createSubject } from '@pkgs/permissions-shared-ts/subject';

const PERMISSION = defineCatalog({
  friendsUse: 'friends:use',
  puzzlesPlay: 'puzzles:play',
  puzzlesCustomizeFeed: 'puzzles:customize-feed',
});
const LIMIT = defineCatalog({
  puzzlesPerDay: 'puzzles:per-day',
  hostedSpaces: 'spaces:hosted',
});
const ROLE = defineCatalog({
  planGuest: 'plan:guest',
  planFree: 'plan:free',
  planPaid: 'plan:paid',
});

const POLICY = definePolicy<
  (typeof PERMISSION)[keyof typeof PERMISSION],
  (typeof LIMIT)[keyof typeof LIMIT]
>({
  roles: {
    [ROLE.planGuest]: {
      permissions: [PERMISSION.puzzlesPlay],
      limits: { [LIMIT.puzzlesPerDay]: 20, [LIMIT.hostedSpaces]: null },
    },
    [ROLE.planFree]: {
      permissions: [
        PERMISSION.friendsUse,
        PERMISSION.puzzlesPlay,
        PERMISSION.puzzlesCustomizeFeed,
      ],
      limits: { [LIMIT.puzzlesPerDay]: null, [LIMIT.hostedSpaces]: 1 },
    },
    [ROLE.planPaid]: {
      permissions: [
        PERMISSION.friendsUse,
        PERMISSION.puzzlesPlay,
        PERMISSION.puzzlesCustomizeFeed,
      ],
      limits: { [LIMIT.puzzlesPerDay]: null, [LIMIT.hostedSpaces]: null },
    },
  },
});

const EVERY_ROLE: readonly RoleId[] = Object.values(ROLE);

describe('can', () => {
  test('grants and denies per role, additively', () => {
    expect(
      can(POLICY, createSubject([ROLE.planGuest]), PERMISSION.friendsUse)
    ).toEqual({ allowed: false, grantedBy: [] });
    expect(
      can(POLICY, createSubject([ROLE.planFree]), PERMISSION.friendsUse)
    ).toEqual({ allowed: true, grantedBy: [ROLE.planFree] });
  });

  test('a different role changes the answer with no engine change', () => {
    const subject = createSubject([ROLE.planGuest]);
    expect(can(POLICY, subject, PERMISSION.puzzlesPlay).allowed).toBe(true);
    expect(can(POLICY, subject, PERMISSION.puzzlesCustomizeFeed).allowed).toBe(
      false
    );
  });

  test('grantedBy lists only the roles that declare it directly', () => {
    const decision = can(
      POLICY,
      createSubject([ROLE.planFree]),
      PERMISSION.friendsUse
    );
    expect(decision.grantedBy).toEqual([ROLE.planFree]);
  });

  test('adding roles never removes a permission (monotonicity)', () => {
    for (const role of EVERY_ROLE) {
      const alone = permissionsOf(POLICY, createSubject([role]));
      const withAll = permissionsOf(POLICY, createSubject(EVERY_ROLE));
      for (const permission of alone) {
        expect(withAll.has(permission)).toBe(true);
      }
    }
  });
});

describe('checkLimit', () => {
  test('a counted cap is exclusive', () => {
    expect(
      checkLimit(
        POLICY,
        createSubject([ROLE.planGuest]),
        LIMIT.puzzlesPerDay,
        19
      )
    ).toEqual({ allowed: true, limit: 20, remaining: 1 });
    expect(
      checkLimit(
        POLICY,
        createSubject([ROLE.planGuest]),
        LIMIT.puzzlesPerDay,
        20
      )
    ).toEqual({ allowed: false, limit: 20, remaining: 0 });
  });

  test('a paid person never hits a usage limit', () => {
    expect(
      checkLimit(
        POLICY,
        createSubject([ROLE.planPaid]),
        LIMIT.puzzlesPerDay,
        1_000_000
      )
    ).toEqual({ allowed: true, limit: null, remaining: null });
  });

  test('remaining never goes negative', () => {
    const verdict = checkLimit(
      POLICY,
      createSubject([ROLE.planGuest]),
      LIMIT.puzzlesPerDay,
      1_000
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.remaining).toBe(0);
  });

  test('an undeclared limit key is unlimited', () => {
    expect(
      checkLimit(POLICY, createSubject([ROLE.planFree]), 'nothing:here', 99)
    ).toEqual({ allowed: true, limit: null, remaining: null });
  });

  test('the same inputs always give the same verdict (purity)', () => {
    const first = checkLimit(
      POLICY,
      createSubject([ROLE.planFree]),
      LIMIT.hostedSpaces,
      1
    );
    const second = checkLimit(
      POLICY,
      createSubject([ROLE.planFree]),
      LIMIT.hostedSpaces,
      1
    );
    expect(first).toEqual(second);
    expect(first).toEqual({ allowed: false, limit: 1, remaining: 0 });
  });

  test('a changed cap changes the verdict with no engine change', () => {
    const changed: PermissionPolicy = {
      roles: {
        ...POLICY.roles,
        [ROLE.planFree]: {
          ...POLICY.roles[ROLE.planFree],
          limits: { [LIMIT.hostedSpaces]: 5 },
        },
      },
    };
    expect(
      checkLimit(changed, createSubject([ROLE.planFree]), LIMIT.hostedSpaces, 4)
        .allowed
    ).toBe(true);
    expect(
      checkLimit(POLICY, createSubject([ROLE.planFree]), LIMIT.hostedSpaces, 4)
        .allowed
    ).toBe(false);
  });
});
