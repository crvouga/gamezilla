/**
 * Entitlement is webhook-driven. Access lasts while `nowMs` is strictly
 * before the status boundary: trial end, period end, or the grace window.
 */

export type SubscriptionEntitlementRow = {
  readonly status: string;
  readonly trial_end: string | null;
  readonly current_period_end: string | null;
  readonly grace_until: string | null;
};

export function subscriptionEntitled(
  row: SubscriptionEntitlementRow | null,
  nowMs: number
): boolean {
  if (row === null) return false;
  const until = (value: string | null): boolean =>
    value !== null && Date.parse(value) > nowMs;
  if (row.status === 'trialing') return until(row.trial_end);
  if (row.status === 'active') return until(row.current_period_end);
  if (row.status === 'past_due') return until(row.grace_until);
  if (row.status === 'canceled') return until(row.current_period_end);
  return false;
}

export type MembershipStatusKind =
  | 'none'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete';

function entitledKind(status: string): MembershipStatusKind {
  if (status === 'trialing') return 'trial';
  if (status === 'active') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled') return 'canceled';
  return 'incomplete';
}

export function membershipStatusKind(
  status: string | null,
  entitled: boolean
): MembershipStatusKind {
  if (status === null || status.length === 0) return 'none';
  if (!entitled) {
    if (
      status === 'incomplete' ||
      status === 'unpaid' ||
      status === 'incomplete_expired'
    ) {
      return 'incomplete';
    }
    return 'expired';
  }
  return entitledKind(status);
}

export function cancelsAtPeriodEnd(value: boolean | number | null): boolean {
  return value === true || value === 1;
}

/** USD catalog amounts are integer cents (`700` → `$7.00`). */
export function formatUsdCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const frac = remainder < 10 ? `0${remainder}` : String(remainder);
  return `${sign}$${dollars}.${frac}`;
}
