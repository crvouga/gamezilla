import type { MembershipStatus } from '@pkgs/billing';

/**
 * Total: every Paddle subscription status maps to one of ours. Paddle creates
 * a subscription only once its first payment settles, so it never reports an
 * incomplete one. A paused subscription grants nothing until resumed; an
 * unknown status fails closed to ended.
 */
export function membershipStatusOf(paddleStatus: string): MembershipStatus {
  switch (paddleStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'delinquent';
    case 'paused':
    case 'canceled':
      return 'ended';
    default:
      return 'ended';
  }
}
