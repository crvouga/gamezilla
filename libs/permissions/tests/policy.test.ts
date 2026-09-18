// goal:guest-free-and-paid:1
// goal:guest-free-and-paid:4
import { describe, expect, test } from 'bun:test';
import { parsePermissionPolicy } from '@libs/permissions/public/parse-permission-policy';

import {
  type AppPermission,
  LIMIT,
  PERMISSION,
  ROLE,
} from '@libs/permissions/public/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions/public/permission-policy';
import {
  can,
  checkLimit,
  createSubject,
  type LimitVerdict,
} from '@pkgs/permissions';

function limitFor(role: string, usage: number): LimitVerdict {
  return checkLimit(
    DEFAULT_PERMISSION_POLICY,
    createSubject([role]),
    LIMIT.puzzlesPerDay,
    usage
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

  test('paid never hits a usage limit but is not offered an upgrade', () => {
    expect(limitFor(ROLE.planGuest, 1_000_000).allowed).toBe(false);
    expect(limitFor(ROLE.planFree, 1_000_000)).toEqual({
      allowed: true,
      limit: null,
      remaining: null,
    });
    expect(limitFor(ROLE.planPaid, 1_000_000)).toEqual({
      allowed: true,
      limit: null,
      remaining: null,
    });
    expect(allows(ROLE.planPaid, PERMISSION.billingManage)).toBe(true);
    expect(allows(ROLE.planPaid, PERMISSION.billingSubscribe)).toBe(false);
  });

  test('a host role inherits the member role', () => {
    expect(allows(ROLE.spaceHost, PERMISSION.spacesWatch)).toBe(true);
    expect(allows(ROLE.spaceHost, PERMISSION.spacesRename)).toBe(true);
    expect(allows(ROLE.spaceMember, PERMISSION.spacesRename)).toBe(false);
  });

  test('every catalog key is referenced by the policy', () => {
    const declaredPermissions = new Set<AppPermission>();
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
          limits: { [LIMIT.puzzlesPerDay]: 3 },
        },
      },
    };
    expect(
      checkLimit(
        changed,
        createSubject([ROLE.planFree]),
        LIMIT.puzzlesPerDay,
        3
      )
    ).toEqual({ allowed: false, limit: 3, remaining: 0 });
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
