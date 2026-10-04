import type { AccountPrivacyContribution } from '@libs/feature-shared/account-privacy';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import sql from '@pkgs/sql-root-shared/sql';
import { CustomerLinks } from './customer-links';

type CloseAccount = {
  readonly accountId: string;
  readonly provider: string;
  readonly subscriptionId: string;
  readonly customerId: string;
};
export const closeAccountMembership = createMessageNamespace(
  'billing',
  'privacy'
)(
  'close-membership',
  (value): value is CloseAccount =>
    isPlainRecord(value) &&
    ['accountId', 'provider', 'subscriptionId', 'customerId'].every(
      (field) => typeof value[field] === 'string'
    )
);

export const BILLING_PRIVACY: AccountPrivacyContribution = {
  name: 'payments and membership',
  snapshot: async ({ tx, env }) => ({
    memberships: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT provider, price_key, status, current_period_end, cancel_at_period_end, credit_cents FROM billing_subscriptions WHERE account_id = ${env.actorId}`
    ),
    payments: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT provider, paid_at, amount_minor, currency, refunded_minor FROM billing_payment_evidence WHERE account_id = ${env.actorId} AND deleted_at IS NULL`
    ),
  }),
  withdraw: async (ctx) => {
    const rows = await ctx.tx.query(
      sql<{
        provider: string;
        provider_subscription_id: string;
      }>`SELECT provider, provider_subscription_id FROM billing_subscriptions WHERE account_id = ${ctx.env.actorId} AND deleted_at IS NULL`
    );
    for (const row of rows) {
      const customerId = await new CustomerLinks(ctx.tx).customerOf(
        ctx.env.actorId,
        row.provider
      );
      if (customerId === null)
        throw new Error('Membership customer link missing');
      await ctx.tx.run(
        sql`INSERT INTO billing_account_closures (id, account_id, provider, subscription_id, customer_id, confirmed_at, cancellation_status) VALUES (${`${row.provider}:${row.provider_subscription_id}`}, ${ctx.env.actorId}, ${row.provider}, ${row.provider_subscription_id}, ${customerId}, ${(ctx.env.serverNow ?? ctx.env.now)().toISOString()}, ${'pending'}) ON CONFLICT (provider, subscription_id) DO NOTHING`
      );
      await new Outbox(ctx).send({
        id: ctx.env.createId(),
        message: closeAccountMembership({
          accountId: ctx.env.actorId,
          provider: row.provider,
          subscriptionId: row.provider_subscription_id,
          customerId,
        }),
      });
    }
    await ctx.tx.run(
      sql`UPDATE billing_subscriptions SET deleted_at = ${(ctx.env.serverNow ?? ctx.env.now)().toISOString()}, status = ${'ended'}, current_period_end = ${null}, cancel_at_period_end = ${true} WHERE account_id = ${ctx.env.actorId}`
    );
  },
  erase: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE billing_subscriptions SET account_id = ${null}, price_key = ${null}, current_period_end = ${null}, credit_cents = ${null} WHERE account_id = ${env.actorId} AND deleted_at IS NOT NULL`
    );
  },
  withdrawalStatus: async ({ tx, env }) => {
    const pending = await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT id FROM billing_account_closures WHERE account_id = ${env.actorId} AND cancellation_status <> ${'complete'} AND deleted_at IS NULL`
    );
    return pending.length > 0 ? 'pending' : 'complete';
  },
};
