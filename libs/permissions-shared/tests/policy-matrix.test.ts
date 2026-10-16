/**
 * The shipped policy, pinned as one table: every plan (reached from its facts,
 * the way the app resolves it) × every catalogued permission, action and
 * limit. Any policy change shows up as a diff of this table.
 */
import { describe, expect, test } from 'bun:test';
import {
  ACTION,
  isQuotaAction,
  LIMIT,
  PERMISSION,
} from '@libs/permissions-shared/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared/permission-policy';
import { decide } from '@pkgs/permissions-shared/decision';
import type { Facts } from '@pkgs/permissions-shared/facts';
import {
  limitsOf,
  permissionsOf,
  quotasOf,
  resolveSubject,
} from '@pkgs/permissions-shared/resolve';

const PLANS: Readonly<Record<'guest' | 'free' | 'paid', Facts>> = {
  guest: { auth: 'anonymous', membership: 'none' },
  free: { auth: 'verified', membership: 'none' },
  paid: { auth: 'verified', membership: 'active', subscription: 'live' },
};

/** Paid access through grace after the membership ended (it no longer renews). */
const PAID_IN_GRACE: Facts = {
  auth: 'verified',
  membership: 'active',
  subscription: 'none',
};

function cell(plan: keyof typeof PLANS, key: string): string {
  const subject = resolveSubject(DEFAULT_PERMISSION_POLICY, PLANS[plan]);
  if (isQuotaAction(key)) {
    const grant = quotasOf(DEFAULT_PERMISSION_POLICY, subject).get(key);
    if (grant === undefined) return 'deny';
    return grant.limit === null
      ? `unlimited/${grant.window}`
      : `${String(grant.limit)}/${grant.window}`;
  }
  return permissionsOf(DEFAULT_PERMISSION_POLICY, subject).has(key)
    ? 'allow'
    : 'deny';
}

function limitCell(plan: keyof typeof PLANS, key: string): string {
  const subject = resolveSubject(DEFAULT_PERMISSION_POLICY, PLANS[plan]);
  const cap = limitsOf(DEFAULT_PERMISSION_POLICY, subject).get(key);
  if (cap === undefined) return 'unset';
  return cap === null ? 'unlimited' : String(cap);
}

/** [key, guest, free, paid] */
const EXPECTED: ReadonlyArray<readonly [string, string, string, string]> = [
  [PERMISSION.friendsUse, 'deny', 'allow', 'allow'],
  [PERMISSION.peopleSearch, 'deny', 'allow', 'allow'],
  [PERMISSION.notificationsReceive, 'deny', 'allow', 'allow'],
  [PERMISSION.profileDeleteAccount, 'deny', 'allow', 'allow'],
  [PERMISSION.profileExportData, 'deny', 'allow', 'allow'],
  [PERMISSION.billingView, 'allow', 'allow', 'allow'],
  [PERMISSION.billingSubscribe, 'deny', 'allow', 'allow'],
  [PERMISSION.billingManage, 'deny', 'allow', 'allow'],
  [PERMISSION.matchmakingUse, 'deny', 'allow', 'allow'],
  [PERMISSION.matchmakingView, 'deny', 'allow', 'allow'],
  [PERMISSION.matchmakingStop, 'deny', 'allow', 'allow'],
  [PERMISSION.matchmakingChangeRange, 'deny', 'allow', 'allow'],
  [PERMISSION.gameMultiplayerWatch, 'deny', 'deny', 'deny'],
  [PERMISSION.gameMultiplayerPlay, 'deny', 'allow', 'allow'],
  [PERMISSION.gameMultiplayerResign, 'deny', 'allow', 'allow'],
  [PERMISSION.puzzlesPlay, 'allow', 'allow', 'allow'],
  [PERMISSION.puzzlesCustomizeFeed, 'deny', 'allow', 'allow'],
  // Environment configuration, never a plan, grants management.
  [PERMISSION.puzzlesManage, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesCreate, 'allow', 'allow', 'allow'],
  [PERMISSION.spacesJoin, 'allow', 'allow', 'allow'],
  // Space roles grant these by presence, never a plan.
  [PERMISSION.spacesLeave, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesRename, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesEnd, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesManageMembers, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesSelectGame, 'deny', 'deny', 'deny'],
  [PERMISSION.syntheticPopulationView, 'deny', 'deny', 'deny'],
  [PERMISSION.syntheticPopulationInspect, 'deny', 'deny', 'deny'],
  [PERMISSION.syntheticPopulationConfigure, 'deny', 'deny', 'deny'],
  [PERMISSION.syntheticPopulationControl, 'deny', 'deny', 'deny'],
  [PERMISSION.syntheticPopulationReplay, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomCreate, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomConfigure, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomInvite, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomBot, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomStart, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomCancel, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomJoin, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomPlay, 'deny', 'deny', 'deny'],
  [PERMISSION.gameCustomWatch, 'deny', 'deny', 'deny'],
  [ACTION.puzzleRatedSolve, '20/day', 'unlimited/day', 'unlimited/day'],
];

describe('shipped policy matrix', () => {
  test('lists every catalogued permission and action exactly once', () => {
    const listed = EXPECTED.map(([key]) => key).sort();
    const catalogued = [
      ...Object.values(PERMISSION),
      ...Object.values(ACTION),
    ].sort();
    expect(listed).toEqual(catalogued);
  });

  test('every plan × key resolves as pinned', () => {
    const actual = EXPECTED.map(([key]) => [
      key,
      cell('guest', key),
      cell('free', key),
      cell('paid', key),
    ]);
    expect(actual).toEqual(EXPECTED.map((row) => [...row]));
  });

  test('every plan × limit resolves as pinned', () => {
    expect(Object.values(LIMIT)).toEqual([
      LIMIT.hostedSpaces,
      LIMIT.unfinishedMultiplayerGames,
    ]);
    expect(
      ['guest', 'free', 'paid'].map((plan) =>
        limitCell(plan as keyof typeof PLANS, LIMIT.unfinishedMultiplayerGames)
      )
    ).toEqual(['1', '1', '1']);
    expect([
      limitCell('guest', LIMIT.hostedSpaces),
      limitCell('free', LIMIT.hostedSpaces),
      limitCell('paid', LIMIT.hostedSpaces),
    ]).toEqual(['1', '1', 'unlimited']);
  });

  test('each fact combination resolves to exactly one plan role', () => {
    for (const auth of ['anonymous', 'verified', undefined]) {
      for (const membership of ['none', 'active', undefined]) {
        const facts: Facts = {
          ...(auth === undefined ? {} : { auth }),
          ...(membership === undefined ? {} : { membership }),
        };
        const plans = resolveSubject(
          DEFAULT_PERMISSION_POLICY,
          facts
        ).roles.filter((role) => role.startsWith('plan:'));
        expect({ facts, n: plans.length }).toEqual({
          facts,
          n:
            auth === 'anonymous' ||
            (auth === 'verified' && membership !== undefined)
              ? 1
              : 0,
        });
      }
    }
  });

  test('restrictions: what each caller is told, with billing on and off', () => {
    const reason = (facts: Facts, key: string): string => {
      const decision = decide(
        DEFAULT_PERMISSION_POLICY,
        resolveSubject(DEFAULT_PERMISSION_POLICY, facts),
        key
      );
      return decision.allowed ? 'allow' : (decision.reason ?? 'not_granted');
    };
    const row = (key: string) => [
      key,
      reason({ ...PLANS.guest, billing: 'on' }, key),
      reason({ ...PLANS.free, billing: 'on' }, key),
      reason({ ...PLANS.paid, billing: 'on' }, key),
      reason({ ...PAID_IN_GRACE, billing: 'on' }, key),
      reason({ ...PLANS.free, billing: 'off' }, key),
    ];
    const A = 'allow';
    const ACCOUNT = 'requires_account';
    const OFF = 'not_granted';
    // [key, guest, free, paid, paid in grace, free with billing off]
    expect([
      row(PERMISSION.friendsUse),
      row(PERMISSION.peopleSearch),
      row(PERMISSION.notificationsReceive),
      row(PERMISSION.matchmakingUse),
      row(PERMISSION.puzzlesCustomizeFeed),
      row(PERMISSION.billingView),
      row(PERMISSION.billingSubscribe),
      row(PERMISSION.billingManage),
      row(PERMISSION.puzzlesPlay),
    ]).toEqual([
      [PERMISSION.friendsUse, ACCOUNT, A, A, A, A],
      [PERMISSION.peopleSearch, ACCOUNT, A, A, A, A],
      [PERMISSION.notificationsReceive, ACCOUNT, A, A, A, A],
      [PERMISSION.matchmakingUse, ACCOUNT, A, A, A, A],
      [PERMISSION.puzzlesCustomizeFeed, ACCOUNT, A, A, A, A],
      [PERMISSION.billingView, A, A, A, A, OFF],
      // A live membership is not offered a second one; an ended one in
      // grace may start again at once.
      [PERMISSION.billingSubscribe, ACCOUNT, A, OFF, A, OFF],
      [PERMISSION.billingManage, ACCOUNT, A, A, A, OFF],
      [PERMISSION.puzzlesPlay, A, A, A, A, A],
    ]);
  });

  test('every requires_account denial has an unlock to follow', () => {
    for (const key of Object.values(PERMISSION)) {
      const decision = decide(
        DEFAULT_PERMISSION_POLICY,
        resolveSubject(DEFAULT_PERMISSION_POLICY, PLANS.guest),
        key
      );
      if (decision.reason !== 'requires_account') continue;
      expect({ key, unlockRef: decision.unlockRef }).toEqual({
        key,
        unlockRef: `${key}#requires_account`,
      });
    }
  });
});
