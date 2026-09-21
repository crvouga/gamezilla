import type { MembershipStatus } from '@pkgs/billing';

import type { MockSubscriptionStatus } from './wire';

const STATUS: Readonly<Record<MockSubscriptionStatus, MembershipStatus>> = {
  incomplete: 'incomplete',
  trialing: 'trialing',
  active: 'active',
  past_due: 'delinquent',
  canceled: 'ended',
  unpaid: 'ended',
  incomplete_expired: 'ended',
  paused: 'ended',
};

/**
 * Total: every mock subscription status maps to one of ours. Unknown strings
 * fail closed to `ended`.
 */
export function membershipStatusOf(status: string): MembershipStatus {
  return Object.hasOwn(STATUS, status)
    ? STATUS[status as MockSubscriptionStatus]
    : 'ended';
}
