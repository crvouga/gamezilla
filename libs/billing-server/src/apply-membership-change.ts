import { scheduleMembershipRecheck } from '@libs/billing-shared/membership-recheck';
import type { MembershipChange } from '@pkgs/billing-root-shared/membership';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlClient, SqlTx } from '@pkgs/sql-client-root-shared/interface';

import { BillingSubscriptionRepository } from './billing-subscription-repository';

/**
 * Projects the membership change a provider reported — a verified callback,
 * a checkout that found the membership already paid, or a re-check — and
 * schedules the next re-check while the membership is not over.
 */
export async function projectMembershipChange(args: {
  readonly tx: SqlTx;
  readonly clock: Clock;
  readonly accountId: string;
  readonly change: MembershipChange;
}): Promise<boolean> {
  const { change } = args;
  const applied = await new BillingSubscriptionRepository(
    args.tx,
    args.clock
  ).upsert({
    provider: change.provider,
    accountId: args.accountId,
    subscriptionId: change.subscriptionId,
    offerPriceKey: change.offerPriceKey,
    status: change.membership.status,
    periodEndMs: change.membership.periodEndMs,
    endsAtPeriodEnd: change.membership.endsAtPeriodEnd,
    creditCents: change.creditCents ?? null,
  });
  if (applied) {
    await scheduleMembershipRecheck(args.tx, change, args.clock.now());
  }
  return applied;
}

/**
 * The single writer of `billing_subscriptions`: opens one transaction and
 * projects the change.
 */
export async function applyMembershipChange(args: {
  readonly sql: SqlClient;
  readonly clock: Clock;
  readonly accountId: string;
  readonly change: MembershipChange;
}): Promise<boolean> {
  return args.sql.transaction((tx) => projectMembershipChange({ ...args, tx }));
}
