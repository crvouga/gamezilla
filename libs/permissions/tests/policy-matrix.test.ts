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
} from '@libs/permissions/public/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions/public/permission-policy';
import {
  type Facts,
  limitsOf,
  permissionsOf,
  quotasOf,
  resolveSubject,
} from '@pkgs/permissions';

const PLANS: Readonly<Record<'guest' | 'free' | 'paid', Facts>> = {
  guest: { auth: 'anonymous', membership: 'none' },
  free: { auth: 'verified', membership: 'none' },
  paid: { auth: 'verified', membership: 'active' },
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
  [PERMISSION.devicesManage, 'deny', 'allow', 'allow'],
  [PERMISSION.billingSubscribe, 'deny', 'allow', 'deny'],
  [PERMISSION.billingManage, 'deny', 'allow', 'allow'],
  [PERMISSION.matchmakingUse, 'deny', 'allow', 'allow'],
  [PERMISSION.puzzlesPlay, 'allow', 'allow', 'allow'],
  [PERMISSION.puzzlesCustomizeFeed, 'deny', 'allow', 'allow'],
  [PERMISSION.spacesCreate, 'allow', 'allow', 'allow'],
  [PERMISSION.spacesJoin, 'allow', 'allow', 'allow'],
  [PERMISSION.spacesWatch, 'allow', 'allow', 'allow'],
  // Space roles grant these by presence, never a plan.
  [PERMISSION.spacesLeave, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesRename, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesEnd, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesSetVisibility, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesManageMembers, 'deny', 'deny', 'deny'],
  [PERMISSION.spacesSelectGame, 'deny', 'deny', 'deny'],
  [ACTION.puzzleRatedSolve, '20/day', 'unlimited/day', 'unlimited/day'],
  [
    ACTION.puzzlePracticeSolve,
    'unlimited/day',
    'unlimited/day',
    'unlimited/day',
  ],
  [ACTION.accountSyncEnable, 'allow', 'allow', 'allow'],
  [ACTION.accountDataExport, 'allow', 'allow', 'allow'],
  [ACTION.coachEnabled, 'allow', 'allow', 'allow'],
  [ACTION.coachExplanationsView, 'allow', 'allow', 'allow'],
  [ACTION.coachRefutationView, 'allow', 'allow', 'allow'],
  [ACTION.statsOverviewView, 'allow', 'allow', 'allow'],
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
    expect(Object.values(LIMIT)).toEqual([LIMIT.hostedSpaces]);
    expect([
      limitCell('guest', LIMIT.hostedSpaces),
      limitCell('free', LIMIT.hostedSpaces),
      limitCell('paid', LIMIT.hostedSpaces),
    ]).toEqual(['unlimited', '1', 'unlimited']);
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
});
