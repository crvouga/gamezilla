/**
 * Guest / free / paid resolution. Pure: the caller supplies the clock and the
 * last known membership state, so the answer is identical offline and on the
 * server.
 */
import type { MembershipStatus } from '@pkgs/billing';

export type Tier = 'guest' | 'free' | 'paid';

export type MembershipSnapshot = {
  readonly status: MembershipStatus;
  readonly currentPeriodEndMs: number | null;
  readonly cancelAtPeriodEnd: boolean;
};

export type ResolveTierInput = {
  readonly signedIn: boolean;
  readonly membership: MembershipSnapshot | null;
  readonly nowMs: number;
  readonly graceMs: number;
};

/**
 * Paid while the membership is active or trialing, or while an ended or
 * delinquent membership is still inside its offline grace window. Anyone
 * signed in without a live membership is free; anyone signed out is a guest.
 */
export function resolveTier(input: ResolveTierInput): Tier {
  if (!input.signedIn) return 'guest';
  const membership = input.membership;
  if (membership === null) return 'free';
  if (membership.status === 'active' || membership.status === 'trialing') {
    return 'paid';
  }
  if (membership.status === 'incomplete') return 'free';
  const end = membership.currentPeriodEndMs;
  if (end === null) return 'free';
  return input.nowMs <= end + input.graceMs ? 'paid' : 'free';
}
