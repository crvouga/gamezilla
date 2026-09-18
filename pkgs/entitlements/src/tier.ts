/**
 * Guest / free / paid resolution. Pure: the caller supplies the clock and the
 * last known subscription state, so the answer is identical offline and on the
 * server.
 */

export type Tier = 'guest' | 'free' | 'paid';

export type SubscriptionSnapshot = {
  readonly status: string;
  readonly currentPeriodEndMs: number | null;
  readonly cancelAtPeriodEnd: boolean;
};

/** Vendor statuses that mean "currently paid for". */
const ACTIVE_STATUSES: Readonly<Record<string, true>> = {
  active: true,
  trialing: true,
};

/** Statuses that ended access at `currentPeriodEndMs`. */
const ENDED_STATUSES: Readonly<Record<string, true>> = {
  canceled: true,
  unpaid: true,
  past_due: true,
  incomplete_expired: true,
};

export type ResolveTierInput = {
  readonly signedIn: boolean;
  readonly subscription: SubscriptionSnapshot | null;
  readonly nowMs: number;
  readonly graceMs: number;
};

/**
 * Paid while the subscription is active, or while a ended subscription is
 * still inside its offline grace window. Anyone signed in without a live
 * subscription is free; anyone signed out is a guest.
 */
export function resolveTier(input: ResolveTierInput): Tier {
  if (!input.signedIn) return 'guest';
  const subscription = input.subscription;
  if (subscription === null) return 'free';
  if (ACTIVE_STATUSES[subscription.status] === true) return 'paid';
  if (ENDED_STATUSES[subscription.status] !== true) return 'free';
  const end = subscription.currentPeriodEndMs;
  if (end === null) return 'free';
  return input.nowMs <= end + input.graceMs ? 'paid' : 'free';
}
