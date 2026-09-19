import {
  definePolicy,
  type PermissionPolicy,
  type QuotaGrant,
} from '@pkgs/permissions';

import {
  ACTION,
  type AppLimit,
  type AppPermission,
  type AppPolicyKey,
  LIMIT,
  PERMISSION,
  ROLE,
} from './permission-catalog';

/** Published id of the shipped policy; carried on every decision. */
export const PERMISSION_POLICY_VERSION = '2026-09-19.1';

const UNLIMITED: QuotaGrant = { limit: null, window: 'day' };

/**
 * Pre-existing product config: an anonymous subject may start 20 rated
 * puzzles per UTC day (no user timezone is stored, so the boundary is UTC).
 */
const ANONYMOUS_RATED: QuotaGrant = {
  limit: 20,
  window: 'day',
  resetBoundary: 'utcMidnight',
};

const ACCOUNT_PERMISSIONS: readonly AppPermission[] = [
  PERMISSION.friendsUse,
  PERMISSION.peopleSearch,
  PERMISSION.notificationsReceive,
  PERMISSION.devicesManage,
  PERMISSION.billingManage,
  PERMISSION.matchmakingUse,
  PERMISSION.puzzlesPlay,
  PERMISSION.puzzlesCustomizeFeed,
  PERMISSION.spacesCreate,
  PERMISSION.spacesJoin,
  PERMISSION.spacesWatch,
];

/**
 * Shipped policy (the fallback when no `permission_policy` row is synced).
 * Permissive baseline: every catalogued Phase-1 grant is on for everyone and
 * practice is unlimited. The only limit is the anonymous rated-puzzle quota;
 * because quotas merge to the maximum, `puzzle.rated.solve` lives on the
 * fact-matched roles (anonymous: 20/day, accounts: unlimited), never on the
 * baseline. Plan roles are listed explicitly — no inheritance — so the paid
 * role can lack `billing:subscribe`; their `when` predicates are exclusive.
 */
export const DEFAULT_PERMISSION_POLICY: PermissionPolicy<
  AppPolicyKey,
  AppLimit
> = definePolicy<AppPolicyKey, AppLimit>({
  version: PERMISSION_POLICY_VERSION,
  activeFromMs: 0,
  roles: {
    [ROLE.baseline]: {
      when: 'always',
      permissions: [
        ACTION.accountSyncEnable,
        ACTION.accountDataExport,
        ACTION.coachEnabled,
        ACTION.coachExplanationsView,
        ACTION.coachRefutationView,
        ACTION.statsOverviewView,
      ],
      quotas: { [ACTION.puzzlePracticeSolve]: UNLIMITED },
    },
    [ROLE.planGuest]: {
      when: { auth: 'anonymous' },
      permissions: [
        PERMISSION.puzzlesPlay,
        PERMISSION.spacesCreate,
        PERMISSION.spacesJoin,
        PERMISSION.spacesWatch,
      ],
      limits: { [LIMIT.hostedSpaces]: null },
      quotas: { [ACTION.puzzleRatedSolve]: ANONYMOUS_RATED },
    },
    [ROLE.planFree]: {
      when: { auth: 'verified', membership: 'none' },
      permissions: [...ACCOUNT_PERMISSIONS, PERMISSION.billingSubscribe],
      limits: { [LIMIT.hostedSpaces]: 1 },
      quotas: { [ACTION.puzzleRatedSolve]: UNLIMITED },
    },
    [ROLE.planPaid]: {
      when: { auth: 'verified', membership: 'active' },
      permissions: ACCOUNT_PERMISSIONS,
      limits: { [LIMIT.hostedSpaces]: null },
      quotas: { [ACTION.puzzleRatedSolve]: UNLIMITED },
    },
    [ROLE.spaceMember]: {
      permissions: [PERMISSION.spacesWatch, PERMISSION.spacesLeave],
    },
    [ROLE.spaceHost]: {
      grants: [ROLE.spaceMember],
      permissions: [
        PERMISSION.spacesRename,
        PERMISSION.spacesEnd,
        PERMISSION.spacesSetVisibility,
        PERMISSION.spacesManageMembers,
        PERMISSION.spacesSelectGame,
      ],
    },
  },
  unlockRefs: {
    [ACTION.puzzleRatedSolve]: {
      quota_exhausted: {
        titleKey: 'unlock.rated.limit.title',
        bodyKey: 'unlock.rated.limit.body',
        ctaTarget: 'billing',
        secondaryCta: 'wait_for_reset',
      },
    },
  },
});
