import type { MembershipStatus } from '@pkgs/billing-root-shared/membership';

/**
 * Total: every Stripe subscription status maps to one of ours. Unknown strings
 * are treated as ended — failing closed is the only safe default.
 */
export function membershipStatusOf(stripeStatus: string): MembershipStatus {
  switch (stripeStatus) {
    case 'incomplete':
      return 'incomplete';
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'delinquent';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'ended';
    default:
      return 'ended';
  }
}
