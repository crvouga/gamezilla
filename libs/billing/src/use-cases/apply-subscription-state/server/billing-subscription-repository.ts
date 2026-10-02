import type { Clock } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

/** One provider membership change, resolved onto an account. */
export type MembershipProjection = {
  readonly provider: string;
  readonly accountId: string;
  readonly subscriptionId: string;
  readonly offerPriceKey: string | null;
  readonly status: string;
  readonly periodEndMs: number | null;
  readonly endsAtPeriodEnd: boolean;
  /**
   * Credit in cents, or `null` when this change did not read it (keep the
   * stored credit). `0` clears it.
   */
  readonly creditCents: number | null;
};

/** Layer C: transaction-scoped writes to `billing_subscriptions`. */
export class BillingSubscriptionRepository {
  constructor(
    private readonly tx: SqlTx,
    private readonly clock: Clock
  ) {}

  /**
   * Upserts the provider's view of a membership. Rows for provider identities
   * that are not linked to an account are never passed here.
   */
  async upsert(projection: MembershipProjection): Promise<boolean> {
    const nowIso = new Date(this.clock.now()).toISOString();
    const periodEnd =
      projection.periodEndMs === null
        ? null
        : new Date(projection.periodEndMs).toISOString();
    const result = await this.tx.run(sql<void>`
      INSERT INTO billing_subscriptions (
        id, created_at, updated_at, deleted_at,
        account_id, provider, provider_subscription_id, price_key,
        status, current_period_end, cancel_at_period_end, credit_cents
      )
      SELECT
        ${`${projection.provider}:${projection.subscriptionId}`},
        ${nowIso}, ${nowIso}, ${null},
        ${projection.accountId},
        ${projection.provider},
        ${projection.subscriptionId},
        ${projection.offerPriceKey},
        ${projection.status},
        ${periodEnd},
        ${projection.endsAtPeriodEnd ? 1 : 0},
        ${projection.creditCents}
      WHERE NOT EXISTS (
        SELECT 1 FROM billing_account_closures
        WHERE account_id = ${projection.accountId}
      )
      ON CONFLICT (id) DO UPDATE SET
        updated_at = EXCLUDED.updated_at,
        account_id = EXCLUDED.account_id,
        provider = EXCLUDED.provider,
        price_key = EXCLUDED.price_key,
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        credit_cents = COALESCE(EXCLUDED.credit_cents, billing_subscriptions.credit_cents)
      WHERE billing_subscriptions.deleted_at IS NULL
    `);
    return result.changes > 0;
  }
}
