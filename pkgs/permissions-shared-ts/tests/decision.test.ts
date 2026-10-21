import { describe, expect, test } from 'bun:test';

import {
  decide,
  decideLimit,
  decideQuota,
  grantedBy,
  quotaWindowOf,
  resolveUnlockRef,
  treatmentOf,
} from '@pkgs/permissions-shared-ts/decision';
import type { Facts } from '@pkgs/permissions-shared-ts/facts';
import { factsHash, matchesPredicate } from '@pkgs/permissions-shared-ts/facts';
import { parsePolicy } from '@pkgs/permissions-shared-ts/parse';
import type { PermissionPolicy } from '@pkgs/permissions-shared-ts/policy';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import {
  paramsOf,
  quotasOf,
  resolveSubject,
} from '@pkgs/permissions-shared-ts/resolve';

const POLICY: PermissionPolicy = {
  version: 'v2',
  activeFromMs: 1_000,
  roles: {
    baseline: {
      when: 'always',
      permissions: ['stats.view'],
      quotas: { 'hint.use': { limit: 3, window: 'day' } },
      params: { 'stats.days': 7 },
    },
    anonymous: {
      when: { auth: 'anonymous' },
      quotas: {
        'puzzle.solve': {
          limit: 5,
          window: 'day',
          resetBoundary: 'userLocalMidnight',
        },
      },
    },
    verified: {
      when: { auth: 'verified' },
      permissions: ['sync.enable'],
      quotas: { 'puzzle.solve': { limit: 15, window: 'day' } },
      params: { 'stats.days': 30 },
    },
    member: {
      when: { auth: 'verified', purchase: ['monthly', 'annual'] },
      quotas: {
        'puzzle.solve': { limit: null, window: 'day' },
        'hint.use': { limit: 1, window: 'day' },
      },
      params: { 'stats.days': null },
    },
    presence: { permissions: ['room.speak', 'room.host'] },
  },
  restrictions: {
    shadow: { when: { fairPlay: 'shadow' }, deny: ['sync.enable'] },
    guestsCannotHost: {
      when: { auth: 'anonymous' },
      deny: ['room.host'],
      reason: 'requires_account',
    },
  },
  unlockRefs: {
    'puzzle.solve': {
      quota_exhausted: { titleKey: 'unlock.limit', ctaTarget: 'offer' },
    },
    'sync.enable': { requires_account: { titleKey: 'unlock.account' } },
  },
  denialReasons: { 'sync.enable': 'requires_account' },
  treatments: { 'stats.view': 'hide' },
  history: [
    {
      version: 'v1',
      activeFromMs: 0,
      roles: {
        baseline: {
          when: 'always',
          quotas: { 'puzzle.solve': { limit: 2, window: 'day' } },
        },
      },
    },
  ],
};

const ANON: Facts = { auth: 'anonymous' };
const VERIFIED: Facts = { auth: 'verified', purchase: [] };
const MEMBER: Facts = { auth: 'verified', purchase: ['annual', 'promo'] };
const SHADOWED: Facts = { auth: 'verified', fairPlay: 'shadow' };

describe('resolveSubject (fact fixtures)', () => {
  test.each([
    ['anonymous', ANON, ['baseline', 'anonymous']],
    ['verified', VERIFIED, ['baseline', 'verified']],
    ['member', MEMBER, ['baseline', 'verified', 'member']],
    ['no facts', {}, ['baseline']],
  ] as const)('%s', (_label, facts, roles) => {
    expect(resolveSubject(POLICY, facts).roles).toEqual([...roles]);
  });

  test('roles without `when` are only added explicitly', () => {
    expect(resolveSubject(POLICY, ANON).roles).not.toContain('presence');
    const subject = resolveSubject(POLICY, ANON, ['presence']);
    expect(decide(POLICY, subject, 'room.speak').allowed).toBe(true);
  });

  test('predicates: AND across keys, any-of within a key, missing = null', () => {
    expect(matchesPredicate({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(matchesPredicate({ a: 1, b: 'x' }, { a: 1 })).toBe(false);
    expect(matchesPredicate({ a: null }, {})).toBe(true);
    expect(matchesPredicate({ p: ['m', 'y'] }, { p: ['y'] })).toBe(true);
    expect(matchesPredicate({ p: ['m'] }, { p: [] })).toBe(false);
  });

  test('factsHash is key-order independent and changes with a fact', () => {
    expect(factsHash({ a: 1, b: 2 })).toBe(factsHash({ b: 2, a: 1 }));
    expect(factsHash({ a: 1 })).not.toBe(factsHash({ a: 2 }));
  });
});

describe('merge semantics', () => {
  test('quotas take the largest limit; unlimited beats every number', () => {
    const verified = resolveSubject(POLICY, VERIFIED);
    expect(quotasOf(POLICY, verified).get('puzzle.solve')?.limit).toBe(15);
    const member = resolveSubject(POLICY, MEMBER);
    expect(quotasOf(POLICY, member).get('puzzle.solve')?.limit).toBeNull();
    // member declares a smaller hint quota; max keeps the baseline's 3.
    expect(quotasOf(POLICY, member).get('hint.use')?.limit).toBe(3);
  });

  test('params take the most permissive value', () => {
    expect(
      paramsOf(POLICY, resolveSubject(POLICY, ANON)).get('stats.days')
    ).toBe(7);
    expect(
      paramsOf(POLICY, resolveSubject(POLICY, VERIFIED)).get('stats.days')
    ).toBe(30);
    expect(
      paramsOf(POLICY, resolveSubject(POLICY, MEMBER)).get('stats.days')
    ).toBeNull();
  });

  test('booleans union; restrictions (deny) beat any grant', () => {
    const verified = resolveSubject(POLICY, VERIFIED);
    expect(decide(POLICY, verified, 'sync.enable')).toEqual({
      allowed: true,
      policyVersion: 'v2',
    });
    const shadowed = resolveSubject(POLICY, SHADOWED);
    expect(decide(POLICY, shadowed, 'sync.enable')).toEqual({
      allowed: false,
      reason: 'restricted',
      policyVersion: 'v2',
    });
    expect(grantedBy(POLICY, verified, 'puzzle.solve')).toEqual(['verified']);
  });

  test('a restriction reports the reason it names', () => {
    const guest = resolveSubject(POLICY, { auth: 'anonymous' }, ['presence']);
    expect(decide(POLICY, guest, 'room.host')).toEqual({
      allowed: false,
      reason: 'requires_account',
      policyVersion: 'v2',
    });
    const verified = resolveSubject(POLICY, VERIFIED, ['presence']);
    expect(decide(POLICY, verified, 'room.host').allowed).toBe(true);
  });
});

describe('decisions: reasons, remaining, resetsAt, unlockRef', () => {
  const noon = Date.UTC(2026, 8, 19, 12);

  test('an ungranted action carries its configured reason + unlockRef', () => {
    const decision = decide(
      POLICY,
      resolveSubject(POLICY, ANON),
      'sync.enable'
    );
    expect(decision).toEqual({
      allowed: false,
      reason: 'requires_account',
      unlockRef: 'sync.enable#requires_account',
      policyVersion: 'v2',
    });
    expect(resolveUnlockRef(POLICY, decision.unlockRef ?? '')).toEqual({
      titleKey: 'unlock.account',
    });
    expect(decide(POLICY, resolveSubject(POLICY, ANON), 'x.y').reason).toBe(
      'not_granted'
    );
    expect(resolveUnlockRef(POLICY, 'nope')).toBeUndefined();
  });

  test('quota: allowed decrements remaining; exhausted denies with resetsAt', () => {
    const subject = resolveSubject(POLICY, VERIFIED);
    const next = Date.UTC(2026, 8, 20);
    expect(
      decideQuota(POLICY, subject, 'puzzle.solve', { used: 13, nowMs: noon })
    ).toEqual({
      allowed: true,
      remaining: 1,
      limit: 15,
      resetsAtMs: next,
      policyVersion: 'v2',
    });
    expect(
      decideQuota(POLICY, subject, 'puzzle.solve', { used: 15, nowMs: noon })
    ).toEqual({
      allowed: false,
      reason: 'quota_exhausted',
      unlockRef: 'puzzle.solve#quota_exhausted',
      remaining: 0,
      limit: 15,
      resetsAtMs: next,
      policyVersion: 'v2',
    });
  });

  test('unlimited quota and undeclared quota', () => {
    const member = resolveSubject(POLICY, MEMBER);
    expect(
      decideQuota(POLICY, member, 'puzzle.solve', { used: 1e9, nowMs: noon })
    ).toEqual({ allowed: true, policyVersion: 'v2' });
    expect(quotaWindowOf(POLICY, member, 'puzzle.solve', { nowMs: noon })).toBe(
      undefined
    );
    expect(
      decideQuota(POLICY, member, 'nope', { used: 0, nowMs: noon }).reason
    ).toBe('not_granted');
  });

  test('limit: below the cap allows, at the cap denies with limit_reached', () => {
    const limited: PermissionPolicy = {
      version: 'l1',
      activeFromMs: 0,
      roles: {
        free: { when: { auth: 'verified' }, limits: { 'rooms.hosted': 1 } },
        paid: {
          when: { purchase: 'annual' },
          limits: { 'rooms.hosted': null },
        },
      },
      unlockRefs: {
        'rooms.hosted': { limit_reached: { titleKey: 'unlock.rooms' } },
      },
    };
    const free = resolveSubject(limited, { auth: 'verified' });
    expect(decideLimit(limited, free, 'rooms.hosted', 0)).toEqual({
      allowed: true,
      remaining: 0,
      limit: 1,
      policyVersion: 'l1',
    });
    expect(decideLimit(limited, free, 'rooms.hosted', 1)).toEqual({
      allowed: false,
      reason: 'limit_reached',
      unlockRef: 'rooms.hosted#limit_reached',
      remaining: 0,
      limit: 1,
      policyVersion: 'l1',
    });
    const paid = resolveSubject(limited, {
      auth: 'verified',
      purchase: 'annual',
    });
    expect(decideLimit(limited, paid, 'rooms.hosted', 50).allowed).toBe(true);
    expect(decideLimit(limited, paid, 'undeclared', 50).allowed).toBe(true);
  });

  test('treatments come from config, default lock for grants / soft for quotas', () => {
    expect(treatmentOf(POLICY, 'stats.view', 'grant')).toBe('hide');
    expect(treatmentOf(POLICY, 'sync.enable', 'grant')).toBe('lock');
    expect(treatmentOf(POLICY, 'puzzle.solve', 'quota')).toBe('soft');
  });
});

describe('policy versions', () => {
  test('policyAt picks the version active at a timestamp', () => {
    expect(policyAt(POLICY, 5_000).version).toBe('v2');
    expect(policyAt(POLICY, 500).version).toBe('v1');
    const v1 = policyAt(POLICY, 500);
    const decision = decideQuota(
      v1,
      resolveSubject(v1, VERIFIED),
      'puzzle.solve',
      {
        used: 2,
        nowMs: 500,
      }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.policyVersion).toBe('v1');
  });

  test('the fixture round-trips through parsePolicy', () => {
    const parsed = parsePolicy(JSON.parse(JSON.stringify(POLICY)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.policy.history?.[0]?.version).toBe('v1');
    expect(parsed.policy.roles['anonymous']?.when).toEqual({
      auth: 'anonymous',
    });
    expect(parsed.policy).toEqual(POLICY);
  });

  test('parsePolicy rejects malformed quotas, predicates and reasons', () => {
    const bad = parsePolicy({
      roles: {
        a: {
          when: { x: { nested: true } },
          quotas: { q: { limit: -1, window: 'day' } },
        },
      },
      unlockRefs: { q: { upgrade: { titleKey: 't' } } },
      treatments: { q: 'blink' },
      history: 'nope',
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.issues.length).toBe(5);
  });

  test('"unlimited" shorthand parses to a null limit', () => {
    const parsed = parsePolicy({
      roles: { a: { when: 'always', quotas: { q: 'unlimited' } } },
    });
    expect(parsed.ok && parsed.policy.roles['a']?.quotas?.['q']?.limit).toBe(
      null
    );
  });
});
