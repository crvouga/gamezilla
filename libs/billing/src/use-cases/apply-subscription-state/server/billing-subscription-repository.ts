import type { SubscriptionChange } from '@pkgs/billing';
import type { Clock } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

export const BILLING_SUBSCRIPTION_PROVIDER = 'stripe';

function rowId(provider: string, providerSubscriptionId: string): string {
  return `${provider}:${providerSubscriptionId}`;
}

/** Layer C: transaction-scoped writes to `billing_subscriptions`. */
export class BillingSubscriptionRepository {
  constructor(
    private readonly tx: SqlTx,
    private readonly clock: Clock
  ) {}

  /**
   * Upserts the provider's view of a subscription. A change without an account
   * link (deleted rows arrive with metadata intact, but be defensive) is
   * ignored by the caller.
   */
  async upsert(
    change: SubscriptionChange & { accountId: string }
  ): Promise<void> {
    const nowIso = new Date(this.clock.now()).toISOString();
    const periodEnd =
      change.currentPeriodEndMs === null
        ? null
        : new Date(change.currentPeriodEndMs).toISOString();
    await this.tx.run(sql<void>`
      INSERT INTO billing_subscriptions (
        id, created_at, updated_at, deleted_at,
        account_id, provider, provider_subscription_id, price_key,
        status, current_period_end, cancel_at_period_end
      )
      VALUES (
        ${rowId(BILLING_SUBSCRIPTION_PROVIDER, change.providerSubscriptionId)},
        ${nowIso}, ${nowIso}, ${null},
        ${change.accountId},
        ${BILLING_SUBSCRIPTION_PROVIDER},
        ${change.providerSubscriptionId},
        ${change.priceKey},
        ${change.status},
        ${periodEnd},
        ${change.cancelAtPeriodEnd ? 1 : 0}
      )
      ON CONFLICT (id) DO UPDATE SET
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL,
        account_id = EXCLUDED.account_id,
        price_key = EXCLUDED.price_key,
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end
    `);
  }
}
