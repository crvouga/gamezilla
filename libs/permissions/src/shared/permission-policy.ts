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
export const PERMISSION_POLICY_VERSION = '2026-09-26.1';

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

/**
 * What only an account may do. Anonymous subjects are denied these with
 * `requires_account`, so every surface that asks gets the same unlock (the
 * policy's `signup` CTA) without knowing why it was denied.
 */
const ACCOUNT_ONLY: readonly AppPermission[] = [
  PERMISSION.friendsUse,
  PERMISSION.peopleSearch,
  PERMISSION.notificationsReceive,
  PERMISSION.devicesManage,
  PERMISSION.billingSubscribe,
  PERMISSION.billingManage,
  PERMISSION.matchmakingUse,
  PERMISSION.puzzlesCustomizeFeed,
];

/**
 * Off while the deployment has no membership provider. `billing:manage` stays:
 * it is what lets an account see its own membership, provider or not.
 */
const BILLING_OFFER: readonly AppPermission[] = [
  PERMISSION.billingView,
  PERMISSION.billingSubscribe,
];

const SIGN_UP_UNLOCK = {
  requires_account: { titleKey: 'unlock.account.title', ctaTarget: 'signup' },
} as const;

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
 * baseline. Plan roles are listed explicitly — no inheritance — and their
 * `when` predicates are exclusive. Both may `billing:subscribe`: a paid
 * account whose membership ended keeps paid access through grace and may
 * start again at once; the billing screen and the checkout route never offer
 * a second checkout while a membership is live.
 *
 * Restrictions carry what used to be feature code: account-only actions deny
 * anonymous subjects with `requires_account`, and the membership offer is off
 * everywhere while the deployment has no provider (`billing: 'off'`).
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
        PERMISSION.billingView,
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
      permissions: [...ACCOUNT_PERMISSIONS, PERMISSION.billingSubscribe],
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
  restrictions: {
    accountOnly: {
      when: { auth: 'anonymous' },
      deny: ACCOUNT_ONLY,
      reason: 'requires_account',
    },
    billingOff: {
      when: { billing: 'off' },
      deny: BILLING_OFFER,
      reason: 'not_granted',
    },
  },
  unlockRefs: {
    [PERMISSION.friendsUse]: {
      requires_account: {
        titleKey: 'unlock.friends.title',
        bodyKey: 'unlock.friends.body',
        ctaTarget: 'signup',
      },
    },
    [PERMISSION.peopleSearch]: {
      requires_account: {
        titleKey: 'unlock.people-search.title',
        bodyKey: 'unlock.people-search.body',
        ctaTarget: 'signup',
      },
    },
    [PERMISSION.notificationsReceive]: {
      requires_account: {
        titleKey: 'unlock.notifications.title',
        bodyKey: 'unlock.notifications.body',
        ctaTarget: 'signup',
      },
    },
    [PERMISSION.billingSubscribe]: {
      requires_account: {
        titleKey: 'unlock.billing-subscribe.title',
        ctaTarget: 'signup',
      },
    },
    [PERMISSION.devicesManage]: SIGN_UP_UNLOCK,
    [PERMISSION.billingManage]: SIGN_UP_UNLOCK,
    [PERMISSION.matchmakingUse]: SIGN_UP_UNLOCK,
    [PERMISSION.puzzlesCustomizeFeed]: SIGN_UP_UNLOCK,
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
