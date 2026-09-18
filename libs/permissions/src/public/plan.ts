import { type PlanRole, ROLE } from './permission-catalog';

/** Last-known subscription state, vendor-status shaped. */
export type SubscriptionSnapshot = {
  readonly status: string;
  readonly currentPeriodEndMs: number | null;
  readonly cancelAtPeriodEnd: boolean;
};

/** Synced `billing_subscriptions` row shape (snake_case, sqlite/postgres booleans). */
export type SubscriptionRow = {
  readonly status: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

/** Vendor statuses that mean "currently paid for". */
const ACTIVE_STATUSES: Record<string, true> = { active: true, trialing: true };

/** Statuses that ended access at `currentPeriodEndMs`. */
const ENDED_STATUSES: Record<string, true> = {
  canceled: true,
  unpaid: true,
  past_due: true,
  incomplete_expired: true,
};

/**
 * Maps a synced subscription row to a snapshot. `undefined` or a blank status
 * means "no subscription"; an unparsable period end becomes `null`.
 */
export function readSubscriptionSnapshot(
  row: SubscriptionRow | undefined
): SubscriptionSnapshot | null {
  if (row === undefined || row.status === null || row.status.length === 0) {
    return null;
  }
  const parsed =
    row.current_period_end === null
      ? Number.NaN
      : Date.parse(row.current_period_end);
  return {
    status: row.status,
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
 * Signed out → guest. Signed in with no live plan → free. An active/trialing
 * plan, or an ended plan still inside `currentPeriodEndMs + graceMs`, → paid.
 */
export function resolvePlanRole(facts: PlanFacts): PlanRole {
  if (!facts.signedIn) return ROLE.planGuest;
  const subscription = facts.subscription;
  if (subscription === null) return ROLE.planFree;
  if (ACTIVE_STATUSES[subscription.status] === true) return ROLE.planPaid;
  if (ENDED_STATUSES[subscription.status] !== true) return ROLE.planFree;
  const end = subscription.currentPeriodEndMs;
  if (end === null) return ROLE.planFree;
  return facts.nowMs <= end + facts.graceMs ? ROLE.planPaid : ROLE.planFree;
}
