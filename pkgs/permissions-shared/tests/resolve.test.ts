import { describe, expect, test } from 'bun:test';

import { createSubject, withRoles } from '@pkgs/permissions-shared/subject';
import { limitsOf, permissionsOf, resolveRoleClosure } from '@pkgs/permissions-shared/resolve';
import type { PermissionPolicy } from '@pkgs/permissions-shared/policy';
import { RoleCycleError } from '@pkgs/permissions-shared/role-cycle-error';
import { UnknownRoleError } from '@pkgs/permissions-shared/unknown-role-error';

const POLICY: PermissionPolicy = {
  roles: {
    guest: { permissions: ['puzzles:play'], limits: { 'puzzles:per-day': 20 } },
    free: {
      grants: ['guest'],
      permissions: ['friends:use'],
      limits: { 'puzzles:per-day': null },
    },
    paid: { grants: ['free'], limits: {} },
    member: { permissions: ['spaces:watch'] },
    host: { grants: ['member'], permissions: ['spaces:end'] },
    root: { grants: ['left', 'right'] },
    left: { grants: ['leaf'] },
    right: { grants: ['leaf'] },
    leaf: {},
    capA: { limits: { shared: 5 } },
    capB: { limits: { shared: 8 } },
    cycleA: { grants: ['cycleB'] },
    cycleB: { grants: ['cycleA'] },
    selfCycle: { grants: ['selfCycle'] },
    orphanGrants: { grants: ['missing'] },
  },
};

describe('resolveRoleClosure', () => {
  test('a role with no grants resolves to itself', () => {
    expect(resolveRoleClosure(POLICY, ['guest'])).toEqual(['guest']);
  });

  test('grants are followed one hop', () => {
    expect(resolveRoleClosure(POLICY, ['free'])).toEqual(['free', 'guest']);
  });

  test('grants are transitive', () => {
    expect(resolveRoleClosure(POLICY, ['paid'])).toEqual([
      'paid',
      'free',
      'guest',
    ]);
  });

  test('a diamond is visited once', () => {
    expect(resolveRoleClosure(POLICY, ['root'])).toEqual([
      'root',
      'left',
      'leaf',
      'right',
    ]);
  });

  test('subject role order leads the closure', () => {
    expect(resolveRoleClosure(POLICY, ['host', 'guest'])).toEqual([
      'host',
      'member',
      'guest',
    ]);
  });

  test('an unknown subject role throws', () => {
    expect(() => resolveRoleClosure(POLICY, ['nope'])).toThrow(
      UnknownRoleError
    );
    try {
      resolveRoleClosure(POLICY, ['nope']);
    } catch (err) {
      expect((err as UnknownRoleError).role).toBe('nope');
    }
  });

  test('an unknown grants target throws', () => {
    expect(() => resolveRoleClosure(POLICY, ['orphanGrants'])).toThrow(
      UnknownRoleError
    );
  });

  test('a grants cycle throws', () => {
    expect(() => resolveRoleClosure(POLICY, ['cycleA'])).toThrow(
      RoleCycleError
    );
    expect(() => resolveRoleClosure(POLICY, ['selfCycle'])).toThrow(
      RoleCycleError
    );
  });
});

describe('permissionsOf', () => {
  test('unions permissions across the closure', () => {
    expect([...permissionsOf(POLICY, createSubject(['paid']))].sort()).toEqual([
      'friends:use',
      'puzzles:play',
    ]);
  });

  test('a permission granted by two roles appears once', () => {
    const policy: PermissionPolicy = {
      roles: {
        a: { permissions: ['x'] },
        b: { grants: ['a'], permissions: ['x'] },
      },
    };
    expect([...permissionsOf(policy, createSubject(['b']))]).toEqual(['x']);
  });

  test('an empty subject holds nothing', () => {
    expect(permissionsOf(POLICY, createSubject([])).size).toBe(0);
  });
});

describe('limitsOf', () => {
  test('a null cap beats a finite cap from an inherited role', () => {
    expect(
      limitsOf(POLICY, createSubject(['free'])).get('puzzles:per-day')
    ).toBe(null);
  });

  test('finite caps merge by max', () => {
    expect(
      limitsOf(POLICY, createSubject(['capA', 'capB'])).get('shared')
    ).toBe(8);
    expect(
      limitsOf(POLICY, createSubject(['capB', 'capA'])).get('shared')
    ).toBe(8);
  });

  test('undeclared keys are absent, not zero', () => {
    expect(limitsOf(POLICY, createSubject(['guest'])).has('nope')).toBe(false);
  });
});

describe('subjects', () => {
  test('createSubject dedupes and keeps order', () => {
    expect(createSubject(['b', 'a', 'b']).roles).toEqual(['b', 'a']);
  });

  test('withRoles is an additive union', () => {
    const base = createSubject(['plan:free']);
    expect(withRoles(base, ['space:host', 'plan:free']).roles).toEqual([
      'plan:free',
      'space:host',
    ]);
    expect(base.roles).toEqual(['plan:free']);
  });
});
