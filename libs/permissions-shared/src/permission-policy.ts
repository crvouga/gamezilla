import type { PermissionPolicy } from '@pkgs/permissions-shared/policy';
import { definePolicy } from '@pkgs/permissions-shared/policy';
import type { QuotaGrant } from '@pkgs/permissions-shared/quota-window';
import type {
  AppLimit,
  AppPermission,
  AppPolicyKey,
} from './permission-catalog';
import { ACTION, LIMIT, PERMISSION, ROLE } from './permission-catalog';

/** Published id of the shipped policy; carried on every decision. */
export const PERMISSION_POLICY_VERSION = '2026-10-05.2';

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
  PERMISSION.profileDeleteAccount,
  PERMISSION.profileExportData,
  PERMISSION.billingSubscribe,
  PERMISSION.billingManage,
  PERMISSION.matchmakingUse,
  PERMISSION.matchmakingView,
  PERMISSION.matchmakingStop,
  PERMISSION.matchmakingChangeRange,
  PERMISSION.chessMultiplayerPlay,
  PERMISSION.chessMultiplayerResign,
  PERMISSION.puzzlesCustomizeFeed,
  PERMISSION.puzzlesManage,
];

/**
 * Off while the deployment has no membership provider: no plans, no checkout
 * and no portal (there is no provider to open one at).
 */
const BILLING_OFFER: readonly AppPermission[] = [
  PERMISSION.billingView,
  PERMISSION.billingSubscribe,
  PERMISSION.billingManage,
];

const SIGN_UP_UNLOCK = {
  requires_account: { titleKey: 'unlock.account.title', ctaTarget: 'signup' },
} as const;
const PRIVACY_UNLOCK = {
  ...SIGN_UP_UNLOCK,
  requires_recent_proof: {
    titleKey: 'unlock.privacy.proof.title',
    ctaTarget: 'signup',
  },
} as const;

const ACCOUNT_PERMISSIONS: readonly AppPermission[] = [
  PERMISSION.friendsUse,
  PERMISSION.peopleSearch,
  PERMISSION.notificationsReceive,
  PERMISSION.profileDeleteAccount,
  PERMISSION.profileExportData,
  PERMISSION.billingManage,
  PERMISSION.matchmakingUse,
  PERMISSION.matchmakingView,
  PERMISSION.matchmakingStop,
  PERMISSION.matchmakingChangeRange,
  PERMISSION.chessMultiplayerPlay,
  PERMISSION.chessMultiplayerResign,
  PERMISSION.puzzlesPlay,
  PERMISSION.puzzlesCustomizeFeed,
  PERMISSION.spacesCreate,
  PERMISSION.spacesJoin,
];

/**
 * Shipped policy (the fallback when no `permission_policy` row is synced).
 * The baseline offers everyone the billing plans (restricted while payments
 * are off). Guests and free accounts host one live space at a
 * time, Plus members any number (`spaces:hosted`, decided with `decideLimit`
 * against the live spaces the actor hosts; reaching it invites to Plus). The
 * only quota is the anonymous rated-puzzle quota;
 * because quotas merge to the maximum, `puzzle.rated.solve` lives on the
 * fact-matched roles (anonymous: 20/day, accounts: unlimited), never on the
 * baseline. Plan roles are listed explicitly — no inheritance — and their
 * `when` predicates are exclusive. Both list `billing:subscribe`: a paid
 * account whose membership ended keeps paid access through grace and may
 * start again at once. While a membership is live (it still renews) a second
 * checkout is not offered — a restriction, so the grace case keeps the grant.
 *
 * Restrictions carry what used to be feature code: account-only actions deny
 * anonymous subjects with `requires_account`, the membership offer and portal
 * are off everywhere while the deployment has no provider (`billing: 'off'`),
 * and a live membership is not offered another (`subscription: 'live'`).
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
      permissions: [PERMISSION.billingView],
    },
    [ROLE.planGuest]: {
      when: { auth: 'anonymous' },
      permissions: [
        PERMISSION.puzzlesPlay,
        PERMISSION.spacesCreate,
        PERMISSION.spacesJoin,
      ],
      limits: {
        [LIMIT.hostedSpaces]: 1,
        [LIMIT.unfinishedMultiplayerGames]: 1,
      },
      quotas: { [ACTION.puzzleRatedSolve]: ANONYMOUS_RATED },
    },
    [ROLE.planFree]: {
      when: { auth: 'verified', membership: 'none' },
      permissions: [...ACCOUNT_PERMISSIONS, PERMISSION.billingSubscribe],
      limits: {
        [LIMIT.hostedSpaces]: 1,
        [LIMIT.unfinishedMultiplayerGames]: 1,
      },
      quotas: { [ACTION.puzzleRatedSolve]: UNLIMITED },
    },
    [ROLE.planPaid]: {
      when: { auth: 'verified', membership: 'active' },
      permissions: [...ACCOUNT_PERMISSIONS, PERMISSION.billingSubscribe],
      limits: {
        [LIMIT.hostedSpaces]: null,
        [LIMIT.unfinishedMultiplayerGames]: 1,
      },
      quotas: { [ACTION.puzzleRatedSolve]: UNLIMITED },
    },
    [ROLE.puzzleManager]: {
      when: { accountId: [] },
      permissions: [PERMISSION.puzzlesManage],
    },
    [ROLE.spaceMember]: {
      permissions: [
        PERMISSION.spacesLeave,
        PERMISSION.chessCustomJoin,
        PERMISSION.chessCustomWatch,
        PERMISSION.chessMultiplayerWatch,
        PERMISSION.chessCustomPlay,
        PERMISSION.chessCustomCancel,
      ],
    },
    [ROLE.spaceHost]: {
      grants: [ROLE.spaceMember],
      permissions: [
        PERMISSION.spacesRename,
        PERMISSION.spacesEnd,
        PERMISSION.spacesManageMembers,
        PERMISSION.spacesSelectGame,
        PERMISSION.chessCustomCreate,
        PERMISSION.chessCustomConfigure,
        PERMISSION.chessCustomInvite,
        PERMISSION.chessCustomBot,
        PERMISSION.chessCustomStart,
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
    alreadySubscribed: {
      when: { subscription: 'live' },
      deny: [PERMISSION.billingSubscribe],
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
    [PERMISSION.billingManage]: SIGN_UP_UNLOCK,
    [PERMISSION.profileDeleteAccount]: PRIVACY_UNLOCK,
    [PERMISSION.profileExportData]: PRIVACY_UNLOCK,
    [PERMISSION.matchmakingUse]: SIGN_UP_UNLOCK,
    [PERMISSION.matchmakingView]: SIGN_UP_UNLOCK,
    [PERMISSION.matchmakingStop]: SIGN_UP_UNLOCK,
    [PERMISSION.matchmakingChangeRange]: SIGN_UP_UNLOCK,
    [PERMISSION.chessMultiplayerPlay]: SIGN_UP_UNLOCK,
    [PERMISSION.chessMultiplayerResign]: SIGN_UP_UNLOCK,
    [LIMIT.unfinishedMultiplayerGames]: {
      limit_reached: { titleKey: 'unlock.multiplayer.finish.title' },
    },
    [PERMISSION.puzzlesCustomizeFeed]: SIGN_UP_UNLOCK,
    [PERMISSION.puzzlesManage]: SIGN_UP_UNLOCK,
    [LIMIT.hostedSpaces]: {
      // Guests and free accounts alike: hosting more is what Plus is for.
      limit_reached: {
        titleKey: 'unlock.hosted-spaces.title',
        bodyKey: 'unlock.hosted-spaces.body',
        ctaTarget: 'billing',
      },
    },
    [ACTION.puzzleRatedSolve]: {
      quota_exhausted: {
        titleKey: 'unlock.rated.limit.title',
        bodyKey: 'unlock.rated.limit.body',
        // Only guests have a rated quota, and a free account is unlimited:
        // signing in, not a plan, is what lifts the limit.
        ctaTarget: 'signup',
        secondaryCta: 'wait_for_reset',
      },
    },
  },
});

/** The policy materialized for one environment's puzzle-management team. */
export function permissionPolicyForPuzzleManagers(
  accountIds: readonly string[]
): PermissionPolicy<AppPolicyKey, AppLimit> {
  return definePolicy<AppPolicyKey, AppLimit>({
    ...DEFAULT_PERMISSION_POLICY,
    roles: {
      ...DEFAULT_PERMISSION_POLICY.roles,
      [ROLE.puzzleManager]: {
        when: { accountId: [...new Set(accountIds)].sort() },
        permissions: [PERMISSION.puzzlesManage],
      },
    },
  });
}
