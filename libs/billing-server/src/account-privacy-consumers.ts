import { accountWithdrawalChanged } from '@libs/feature-shared/account-privacy';
import type { MembershipProviders } from '@pkgs/billing-shared/providers';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';
import sql from '@pkgs/sql-shared/sql';
import { closeAccountMembership } from '@libs/billing-shared/account-privacy';
import {
  eraseExpiredPaymentEvidence,
  paymentRetentionEnded,
} from '@libs/billing-shared/payment-evidence';
import { settleDeletedAccountPayments } from './settle-deleted-payments';

export function registerBillingPrivacyConsumers(
  registry: OutboxConsumerRegistry,
  providers: MembershipProviders | null
): void {
  registry.register({
    id: 'billing-erase-expired-payment',
    on: paymentRetentionEnded,
    handler: async (ctx) => {
      await eraseExpiredPaymentEvidence(ctx.tx, ctx.clock.now());
    },
  });
  registry.register({
    id: 'billing-close-deleted-membership',
    on: closeAccountMembership,
    handler: async (ctx, payload) => {
      const provider = providers?.byId.get(payload.provider);
      if (provider === undefined)
        throw new Error(
          'The membership provider is unavailable; cancellation is still pending.'
        );
      const rows = await ctx.tx.query(
        sql<{
          confirmed_at: string;
        }>`SELECT confirmed_at FROM billing_account_closures WHERE provider = ${payload.provider} AND subscription_id = ${payload.subscriptionId}`
      );
      if (rows[0] === undefined)
        throw new Error('Confirmed account withdrawal missing');
      await provider.cancelMembership(payload.subscriptionId);
      await settleDeletedAccountPayments({
        tx: ctx.tx,
        provider,
        customerId: payload.customerId,
        accountId: payload.accountId,
        confirmedAtMs: Date.parse(rows[0].confirmed_at),
        nowMs: ctx.clock.now(),
      });
      await ctx.tx.run(
        sql`UPDATE billing_account_closures SET cancellation_status = ${'complete'} WHERE provider = ${payload.provider} AND subscription_id = ${payload.subscriptionId}`
      );
      await new Outbox({
        tx: ctx.tx,
        env: { now: () => new Date(ctx.clock.now()), createId: ctx.createId },
      }).send({
        id: ctx.createId(),
        message: accountWithdrawalChanged({ accountId: payload.accountId }),
      });
      return { notifyUserIds: [payload.accountId] };
    },
  });
}
