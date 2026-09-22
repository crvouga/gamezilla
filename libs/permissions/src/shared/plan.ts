import {
  governingMembership,
  type MembershipStatus,
  readMembershipStatus,
} from '@pkgs/billing';

import { type Facts, resolveSubject } from '@pkgs/permissions';

import { type PlanRole, ROLE } from './permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from './permission-policy';

/** Last-known membership state: our vocabulary, never a vendor status. */
export type SubscriptionSnapshot = {
  readonly status: MembershipStatus;
  readonly currentPeriodEndMs: number | null;
  readonly cancelAtPeriodEnd: boolean;
};

/** Synced `billing_subscriptions` row shape (snake_case, sqlite/postgres booleans). */
export type SubscriptionRow = {
  readonly status: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

/**
 * Maps a synced subscription row to a snapshot. `undefined`, a blank status or
 * a status outside our vocabulary means "no membership" — an unreadable row
 * grants nothing. An unparsable period end becomes `null`.
 */
export function readSubscriptionSnapshot(
  row: SubscriptionRow | undefined
): SubscriptionSnapshot | null {
  if (row === undefined) return null;
  const status = readMembershipStatus(row.status);
  if (status === null) return null;
  const parsed =
    row.current_period_end === null
      ? Number.NaN
      : Date.parse(row.current_period_end);
  return {
    status,
    currentPeriodEndMs: Number.isFinite(parsed) ? parsed : null,
    cancelAtPeriodEnd:
      row.cancel_at_period_end === true || row.cancel_at_period_end === 1,
  };
}

/**
 * The snapshot that decides access among all of an account's rows — one per
 * provider it ever joined through, more after a resubscribe. The one granting
 * the most governs, not the newest: a late callback about a membership that
 * ended at one provider must not hide a live one at another. Rows arrive
 * newest first, which breaks full ties.
 */
export function governingSubscription(
  rows: readonly SubscriptionRow[]
): SubscriptionSnapshot | null {
  const snapshots = rows.flatMap((row) => {
    const snapshot = readSubscriptionSnapshot(row);
    return snapshot === null ? [] : [snapshot];
  });
  return governingMembership(snapshots, (snapshot) => ({
    status: snapshot.status,
    periodEndMs: snapshot.currentPeriodEndMs,
  }));
}

export type PlanFacts = {
  readonly signedIn: boolean;
  readonly subscription: SubscriptionSnapshot | null;
  readonly nowMs: number;
  readonly graceMs: number;
};

function membershipLive(facts: PlanFacts): boolean {
  const subscription = facts.subscription;
  if (subscription === null) return false;
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return true;
  }
  if (subscription.status === 'incomplete') return false;
  const end = subscription.currentPeriodEndMs;
  if (end === null) return false;
  return facts.nowMs <= end + facts.graceMs;
}

/**
 * Raw inputs → the `Facts` the policy's role predicates read. `auth` is
 * `anonymous` | `verified`; `membership` is `active` while an active or
 * trialing membership lasts and, for a delinquent or ended one, until
 * `currentPeriodEndMs + graceMs` (which keeps a member a member while
 * offline); an incomplete membership is `none`.
 */
export function resolveAccessFacts(facts: PlanFacts): Facts {
  return {
    auth: facts.signedIn ? 'verified' : 'anonymous',
    membership: facts.signedIn && membershipLive(facts) ? 'active' : 'none',
  };
}

const PLAN_ROLES: ReadonlySet<string> = new Set<PlanRole>([
  ROLE.planGuest,
  ROLE.planFree,
  ROLE.planPaid,
]);

/**
 * The plan role the shipped policy's predicates assign for these facts — a
 * label for billing's own screen, never an access decision (those go through
 * `usePermissions`).
 */
export function resolvePlanRole(facts: PlanFacts): PlanRole {
  const subject = resolveSubject(
    DEFAULT_PERMISSION_POLICY,
    resolveAccessFacts(facts)
  );
  const role = subject.roles.find((candidate) => PLAN_ROLES.has(candidate));
  return (role ?? ROLE.planGuest) as PlanRole;
}
