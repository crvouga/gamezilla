import type { MembershipChange } from '@pkgs/billing';
import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { BillingSubscriptionRepository } from './billing-subscription-repository';

/**
 * The single writer of `billing_subscriptions`: opens one transaction and
 * projects the membership change. Shared by the provider callback route and
 * the fake provider's mock routes.
 */
export async function applyMembershipChange(args: {
  readonly sql: SqlClient;
  readonly clock: Clock;
  readonly accountId: string;
  readonly change: MembershipChange;
}): Promise<void> {
  const { change } = args;
  await args.sql.transaction(async (tx) => {
    await new BillingSubscriptionRepository(tx, args.clock).upsert({
      provider: change.provider,
      accountId: args.accountId,
      subscriptionId: change.subscriptionId,
      offerPriceKey: change.offerPriceKey,
      status: change.membership.status,
      periodEndMs: change.membership.periodEndMs,
      endsAtPeriodEnd: change.membership.endsAtPeriodEnd,
    });
  });
}
