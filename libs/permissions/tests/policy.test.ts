// goal:guest-free-and-paid:1
// goal:guest-free-and-paid:4
import { describe, expect, test } from 'bun:test';
import {
  ACTION,
  type AppPermission,
  LIMIT,
  PERMISSION,
} from '@libs/permissions/public/permission-catalog';
import {
  DEFAULT_PERMISSION_POLICY,
  parsePermissionPolicy,
  ROLE,
} from '@libs/permissions/root/access-model';
import {
  can,
  createSubject,
  type Decision,
  decideQuota,
} from '@pkgs/permissions';

const NOON = Date.UTC(2026, 8, 19, 12);

function ratedFor(role: string, used: number): Decision {
  return decideQuota(
    DEFAULT_PERMISSION_POLICY,
    createSubject([ROLE.baseline, role]),
    ACTION.puzzleRatedSolve,
    { used, nowMs: NOON }
  );
}

function allows(role: string, permission: AppPermission): boolean {
  return can(DEFAULT_PERMISSION_POLICY, createSubject([role]), permission)
    .allowed;
}

describe('DEFAULT_PERMISSION_POLICY', () => {
  test('resolves every role without throwing', () => {
    for (const role of Object.values(ROLE)) {
      expect(() => allows(role, PERMISSION.puzzlesPlay)).not.toThrow();
    }
  });

  test('guest is the least: no friends, search or notifications', () => {
    expect(allows(ROLE.planGuest, PERMISSION.friendsUse)).toBe(false);
    expect(allows(ROLE.planGuest, PERMISSION.peopleSearch)).toBe(false);
    expect(allows(ROLE.planGuest, PERMISSION.notificationsReceive)).toBe(false);
    expect(allows(ROLE.planGuest, PERMISSION.puzzlesPlay)).toBe(true);
  });

  test('free adds the account features', () => {
    for (const permission of [
      PERMISSION.friendsUse,
      PERMISSION.peopleSearch,
      PERMISSION.notificationsReceive,
      PERMISSION.devicesManage,
      PERMISSION.billingSubscribe,
      PERMISSION.billingManage,
    ]) {
      expect(allows(ROLE.planFree, permission)).toBe(true);
    }
  });

  test('paid never hits a usage limit and may start a new membership', () => {
    expect(ratedFor(ROLE.planGuest, 1_000_000).allowed).toBe(false);
    expect(ratedFor(ROLE.planFree, 1_000_000)).toEqual({
      allowed: true,
      policyVersion: DEFAULT_PERMISSION_POLICY.version ?? '0',
    });
    expect(ratedFor(ROLE.planPaid, 1_000_000)).toEqual({
      allowed: true,
      policyVersion: DEFAULT_PERMISSION_POLICY.version ?? '0',
    });
    expect(allows(ROLE.planPaid, PERMISSION.billingManage)).toBe(true);
    // Paid access outlives an ended membership (grace); starting a new one
    // must not wait for grace to run out. A live membership is never offered
    // a second checkout — the billing screen and checkout route refuse it.
    expect(allows(ROLE.planPaid, PERMISSION.billingSubscribe)).toBe(true);
  });

  test('a host role inherits the member role', () => {
    expect(allows(ROLE.spaceHost, PERMISSION.spacesWatch)).toBe(true);
    expect(allows(ROLE.spaceHost, PERMISSION.spacesRename)).toBe(true);
    expect(allows(ROLE.spaceMember, PERMISSION.spacesRename)).toBe(false);
  });

  test('every catalog key is referenced by the policy', () => {
    const declaredPermissions = new Set<string>();
    const declaredLimits = new Set<string>();
    for (const spec of Object.values(DEFAULT_PERMISSION_POLICY.roles)) {
      for (const permission of spec.permissions ?? []) {
        declaredPermissions.add(permission);
      }
      for (const limit of Object.keys(spec.limits ?? {})) {
        declaredLimits.add(limit);
      }
    }
    for (const permission of Object.values(PERMISSION)) {
      expect(declaredPermissions.has(permission)).toBe(true);
    }
    for (const limit of Object.values(LIMIT)) {
      expect(declaredLimits.has(limit)).toBe(true);
    }
    for (const role of Object.values(ROLE)) {
      expect(DEFAULT_PERMISSION_POLICY.roles[role]).toBeDefined();
    }
  });

  test('a changed cap changes the verdict with no code change', () => {
    const changed = {
      roles: {
        ...DEFAULT_PERMISSION_POLICY.roles,
        [ROLE.planFree]: {
          ...DEFAULT_PERMISSION_POLICY.roles[ROLE.planFree],
          quotas: {
            [ACTION.puzzleRatedSolve]: { limit: 3, window: 'day' as const },
          },
        },
      },
    };
    expect(
      decideQuota(
        changed,
        createSubject([ROLE.planFree]),
        ACTION.puzzleRatedSolve,
        { used: 3, nowMs: NOON }
      )
    ).toMatchObject({ allowed: false, limit: 3, remaining: 0 });
  });

  test('a malformed stored policy degrades to the shipped policy', () => {
    expect(parsePermissionPolicy({ roles: 'nope' })).toBe(
      DEFAULT_PERMISSION_POLICY
    );
    expect(parsePermissionPolicy(null)).toBe(DEFAULT_PERMISSION_POLICY);
  });

  test('a JSON-string policy parses', () => {
    const parsed = parsePermissionPolicy(
      JSON.stringify({
        roles: { solo: { permissions: [PERMISSION.friendsUse] } },
      })
    );
    expect(parsed.roles['solo']?.permissions).toEqual([PERMISSION.friendsUse]);
  });
});
