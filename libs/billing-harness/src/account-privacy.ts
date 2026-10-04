import { runPrivacyJobs } from '@libs/account-privacy-harness/privacy-actions';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import sql from '@pkgs/sql-shared/sql';
import { billingProviders, customerOf } from './billing-provider-driver';

export async function membershipCannotRenew(
  s: ProductHarness,
  accountId: string
): Promise<boolean> {
  const closures = await s.harness.serverSql.sqlClient.query(
    sql<{
      provider: string;
      subscription_id: string;
    }>`SELECT provider, subscription_id FROM billing_account_closures WHERE account_id = ${accountId} AND deleted_at IS NULL`
  );
  if (closures.length === 0) return false;
  for (const closure of closures) {
    const provider = billingProviders(s).get(closure.provider);
    if (
      provider === undefined ||
      (await provider.stripe.subscriptions.retrieve(closure.subscription_id))
        .status !== 'canceled'
    )
      return false;
  }
  return true;
}

export const pauseCancellation = scenarioAction({
  name: 'pauseCancellation',
  act: async (s) => {
    s.harness.partition('server-a', 'billing');
    s.harness.partition('server-b', 'billing');
  },
});

export async function minimumPayments(s: ProductHarness, accountId: string) {
  return s.harness.serverSql.sqlClient.query(
    sql<{
      provider: string;
      payment_id: string;
      paid_at: string;
      amount_minor: number;
      currency: string;
      refunded_minor: number;
    }>`SELECT provider, payment_id, paid_at, amount_minor, currency, refunded_minor FROM billing_payment_evidence WHERE account_id = ${accountId} AND deleted_at IS NULL`
  );
}

export const paymentAfterDeletion = scenarioAction({
  name: 'paymentAfterDeletion',
  act: async (s, accountId: string) => {
    const provider = billingProviders(s).checkout();
    const closures = await s.harness.serverSql.sqlClient.query(
      sql<{
        customer_id: string;
      }>`SELECT customer_id FROM billing_account_closures WHERE account_id = ${accountId} AND provider = ${provider.id}`
    );
    const customer = closures[0]?.customer_id;
    if (customer === undefined)
      throw new Error(
        'The deleted account needs a membership payment customer'
      );
    await s.session.advanceTime(1_000);
    const payment = await provider.stripe.paymentIntents.create({
      customer,
      amount: 500,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
    });
    const chargeId =
      typeof payment.latest_charge === 'string'
        ? payment.latest_charge
        : payment.latest_charge?.id;
    if (chargeId === undefined)
      throw new Error('The provider did not capture a membership payment');
  },
});

export async function paymentRefund(
  s: ProductHarness,
  providerId: string,
  paymentId: string
) {
  const provider = billingProviders(s)
    .all()
    .find((candidate) => candidate.id === providerId);
  if (provider === undefined) throw new Error('Payment provider missing');
  const payment = await provider.stripe.charges.retrieve(paymentId);
  return { paid: payment.amount_captured, refunded: payment.amount_refunded };
}

export const resumeCancellation = scenarioAction({
  name: 'resumeCancellation',
  act: async (s) => {
    s.harness.heal('server-a', 'billing');
    s.harness.heal('server-b', 'billing');
    await s.session.advanceTime(1_000);
    await Promise.resolve(runPrivacyJobs.act(s));
  },
});

export async function cancellationPending(
  s: ProductHarness,
  accountId: string
): Promise<boolean> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      cancellation_status: string;
    }>`SELECT cancellation_status FROM billing_account_closures WHERE account_id = ${accountId} AND deleted_at IS NULL`
  );
  return (
    rows.length > 0 && rows.some((row) => row.cancellation_status === 'pending')
  );
}

export async function newestPaymentRefund(
  s: ProductHarness,
  accountId: string
) {
  const provider = billingProviders(s).checkout();
  const closures = await s.harness.serverSql.sqlClient.query(
    sql<{
      customer_id: string;
    }>`SELECT customer_id FROM billing_account_closures WHERE account_id = ${accountId} AND provider = ${provider.id}`
  );
  const customer = closures[0]?.customer_id;
  if (customer === undefined) throw new Error('Membership customer missing');
  const charges = await provider.stripe.charges.list({ customer, limit: 1 });
  const charge = charges.data[0];
  if (charge === undefined) throw new Error('Membership payment missing');
  return { paid: charge.amount_captured, refunded: charge.amount_refunded };
}

export const agePaymentRetention = scenarioAction({
  name: 'agePaymentRetention',
  act: async (s, accountId: string) => {
    const rows = await s.harness.serverSql.sqlClient.query(
      sql<{
        erase_by: string;
      }>`SELECT erase_by FROM billing_payment_evidence WHERE account_id = ${accountId} AND deleted_at IS NULL ORDER BY erase_by DESC`
    );
    const deadline = rows[0]?.erase_by;
    if (deadline === undefined)
      throw new Error('An actual membership payment is required');
    await s.session.scheduler.underlying.sleep(
      Math.max(0, Date.parse(deadline) - s.harness.clock.now())
    );
  },
});

export async function paymentHasLegalHold(
  s: ProductHarness,
  accountId: string
): Promise<boolean> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<
      Record<string, unknown>
    >`SELECT id FROM billing_payment_evidence WHERE account_id = ${accountId} AND legal_purpose IS NOT NULL AND deleted_at IS NULL`
  );
  return rows.length > 0;
}

export const makeMembershipPayment = scenarioAction({
  name: 'makeMembershipPayment',
  act: async (s, accountId: string) => {
    const provider = billingProviders(s).checkout();
    const customer = await customerOf(s, accountId, provider);
    await provider.stripe.paymentIntents.create({
      customer,
      amount: 500,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
    });
    await s.session.advanceTime(2_000);
    await s.session.waitForIdle();
  },
});
