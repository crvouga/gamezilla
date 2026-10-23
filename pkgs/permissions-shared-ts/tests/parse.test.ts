import { describe, expect, test } from 'bun:test';

import { parsePolicy } from '@pkgs/permissions-shared-ts/parse';

const VALID = {
  roles: {
    guest: { permissions: ['puzzles:play'], limits: { 'puzzles:per-day': 20 } },
    free: {
      grants: ['guest'],
      permissions: ['friends:use'],
      limits: { 'puzzles:per-day': null },
    },
  },
};

function issues(raw: unknown): readonly string[] {
  const result = parsePolicy(raw);
  return result.ok ? [] : result.issues;
}

describe('parsePolicy accepts', () => {
  test('a well-formed policy', () => {
    const result = parsePolicy(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.policy.roles)).toEqual(['guest', 'free']);
    expect(result.policy.roles['free']?.limits).toEqual({
      'puzzles:per-day': null,
    });
  });

  test('a role with no keys', () => {
    expect(parsePolicy({ roles: { empty: {} } }).ok).toBe(true);
  });

  test('frozen output', () => {
    const result = parsePolicy(VALID);
    if (!result.ok) throw new Error('expected ok');
    expect(Object.isFrozen(result.policy.roles)).toBe(true);
    expect(Object.isFrozen(result.policy.roles['guest'])).toBe(true);
    expect(Object.isFrozen(result.policy.roles['guest']?.permissions)).toBe(
      true
    );
  });

  test('duplicate permissions are deduped', () => {
    const result = parsePolicy({ roles: { a: { permissions: ['x', 'x'] } } });
    if (!result.ok) throw new Error('expected ok');
    expect(result.policy.roles['a']?.permissions).toEqual(['x']);
  });
});

describe('parsePolicy rejects', () => {
  test.each([
    [null, 'policy must be an object'],
    [[], 'policy must be an object'],
    ['policy', 'policy must be an object'],
    [42, 'policy must be an object'],
    [{}, 'policy.roles must be an object'],
    [{ roles: [] }, 'policy.roles must be an object'],
  ])('%p → %s', (raw, expected) => {
    expect(issues(raw)).toContain(expected);
  });

  test('an empty role id', () => {
    expect(issues({ roles: { '': {} } })).toContain(
      'role ids must be non-empty'
    );
  });

  test('a non-object role spec', () => {
    expect(issues({ roles: { a: 'nope' } })).toContain(
      'role "a" must be an object'
    );
  });

  test('an unknown key inside a role spec', () => {
    expect(issues({ roles: { a: { nope: true } } })).toContain(
      'role "a": unexpected key "nope"'
    );
  });

  test('a permission list with a non-string entry', () => {
    expect(issues({ roles: { a: { permissions: ['x', 7] } } })).toContain(
      'role "a".permissions must be an array of non-empty strings'
    );
  });

  test('an empty-string permission', () => {
    expect(issues({ roles: { a: { permissions: [''] } } })).toContain(
      'role "a".permissions must be an array of non-empty strings'
    );
  });

  test('a grants list that is not an array', () => {
    expect(issues({ roles: { a: { grants: 'b' } } })).toContain(
      'role "a".grants must be an array of non-empty strings'
    );
  });

  test('a non-object limits block', () => {
    expect(issues({ roles: { a: { limits: 3 } } })).toContain(
      'role "a".limits must be an object'
    );
  });

  test.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, '5', true])(
    'a bad limit value %p',
    (cap) => {
      expect(issues({ roles: { a: { limits: { k: cap } } } })).toContain(
        'role "a".limits["k"] must be null or a non-negative integer'
      );
    }
  );

  test('an unknown grants target', () => {
    expect(issues({ roles: { a: { grants: ['ghost'] } } })).toContain(
      'role "a" grants unknown role "ghost"'
    );
  });

  test('a grants cycle', () => {
    const found = issues({
      roles: { a: { grants: ['b'] }, b: { grants: ['a'] } },
    });
    expect(
      found.some((issue) => issue.startsWith('role grants form a cycle'))
    ).toBe(true);
  });

  test('a self-grant', () => {
    const found = issues({ roles: { a: { grants: ['a'] } } });
    expect(
      found.some((issue) => issue.startsWith('role grants form a cycle'))
    ).toBe(true);
  });

  test('more roles than the cap', () => {
    const roles: Record<string, unknown> = {};
    for (let i = 0; i < 65; i += 1) roles[`role-${i}`] = {};
    expect(issues({ roles })).toContain(
      'policy.roles must hold at most 64 roles'
    );
  });

  test('more permissions than the cap', () => {
    const permissions: string[] = [];
    for (let i = 0; i < 257; i += 1) permissions.push(`p:${i}`);
    expect(issues({ roles: { a: { permissions } } })).toContain(
      'role "a".permissions must hold at most 256 entries'
    );
  });

  test('returns every issue, not just the first', () => {
    const found = issues({ roles: { a: 'nope', '': {} } });
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  test('a restriction reason outside the vocabulary', () => {
    expect(
      issues({
        roles: {},
        restrictions: { r: { when: 'always', deny: ['a'], reason: 'nope' } },
      })
    ).toContain('policy.restrictions["r"].reason must be a denial reason');
  });
});
