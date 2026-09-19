import type { MembershipStatus } from '@pkgs/billing';

import { type PlanRole, ROLE } from './permission-catalog';

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

const MEMBERSHIP_STATUSES: Readonly<Record<string, MembershipStatus>> = {
  incomplete: 'incomplete',
  trialing: 'trialing',
  active: 'active',
  delinquent: 'delinquent',
  ended: 'ended',
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
  const status =
    row.status === null ? null : (MEMBERSHIP_STATUSES[row.status] ?? null);
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

export type PlanFacts = {
  readonly signedIn: boolean;
  readonly subscription: SubscriptionSnapshot | null;
  readonly nowMs: number;
  readonly graceMs: number;
};

/**
 * Signed out → guest. Signed in with no live membership → free. An active or
 * trialing membership is paid; a delinquent or ended one stays paid until
 * `currentPeriodEndMs + graceMs`, which is what keeps a paid person paid while
 * they are offline. An incomplete membership never grants access.
 */
export function resolvePlanRole(facts: PlanFacts): PlanRole {
  if (!facts.signedIn) return ROLE.planGuest;
  const subscription = facts.subscription;
  if (subscription === null) return ROLE.planFree;
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return ROLE.planPaid;
  }
  if (subscription.status === 'incomplete') return ROLE.planFree;
  const end = subscription.currentPeriodEndMs;
  if (end === null) return ROLE.planFree;
  return facts.nowMs <= end + facts.graceMs ? ROLE.planPaid : ROLE.planFree;
}
