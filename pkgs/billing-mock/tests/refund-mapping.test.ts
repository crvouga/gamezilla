/**
 * A refunded membership ends with no paid time left, whichever event brings
 * the news and whatever the subscription's own status still says.
 */
// regression: refund-kept-grace
import { describe, expect, test } from 'bun:test';
import type { CallbackResult } from '@pkgs/billing';
import { CONTRACT_OFFER } from '@pkgs/billing/membership-billing-contract';
import {
  MOCK_BILLING_SIGNATURE_HEADER,
  MockMembershipBilling,
  signMockBillingPayload,
} from '@pkgs/billing-mock';

const NOW_MS = 1_800_000_000_000;
const PERIOD_END_S = NOW_MS / 1000 + 20 * 86_400;
const WEBHOOK_SECRET = 'whsec_refund';

function invoice(amountPaid: number, amountRefunded: number) {
  return {
    id: 'in_refund',
    object: 'invoice',
    customer: 'cus_refund',
    subscription: 'sub_refund',
    status: 'paid',
    amount_paid: amountPaid,
    amount_refunded: amountRefunded,
  };
}

function subscription(
  status: string,
  latestInvoice: ReturnType<typeof invoice>
) {
  return {
    id: 'sub_refund',
    object: 'subscription',
    customer: 'cus_refund',
    status,
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: status === 'canceled' ? NOW_MS / 1000 : null,
    ended_at: status === 'canceled' ? NOW_MS / 1000 : null,
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [
        {
          id: 'si_refund',
          object: 'subscription_item',
          quantity: 1,
          current_period_start: PERIOD_END_S - 30 * 86_400,
          current_period_end: PERIOD_END_S,
          price: { id: 'price_refund', lookup_key: 'subscription_monthly' },
        },
      ],
    },
    latest_invoice: latestInvoice,
    metadata: {},
  };
}

const REFUND = {
  id: 're_1',
  object: 'refund',
  amount: 500,
  currency: 'usd',
  customer: 'cus_refund',
  invoice: 'in_refund',
  subscription: 'sub_refund',
  status: 'succeeded',
  created: NOW_MS / 1000,
};

async function project(
  current: Record<string, unknown>,
  type: string,
  object: Record<string, unknown>
): Promise<CallbackResult> {
  const billing = new MockMembershipBilling({
    origin: 'http://billing.refund',
    secretKey: 'sk_test_refund',
    webhookSecret: WEBHOOK_SECRET,
    offer: CONTRACT_OFFER,
    now: () => NOW_MS,
    fetch: () => Promise.resolve(Response.json(current)),
  });
  const rawBody = JSON.stringify({
    id: 'evt_refund',
    object: 'event',
    type,
    data: { object },
  });
  const header = signMockBillingPayload({
    secret: WEBHOOK_SECRET,
    payload: rawBody,
    timestampS: NOW_MS / 1000,
  });
  return await billing.readCallback({
    headers: new Headers({ [MOCK_BILLING_SIGNATURE_HEADER]: header }),
    rawBody,
  });
}

const ENDED_NO_GRACE = {
  status: 'ended',
  periodEndMs: null,
  endsAtPeriodEnd: false,
};

describe('a refunded membership', () => {
  test('ends with no paid time left when the refund arrives', async () => {
    const current = subscription('active', invoice(500, 500));
    const result = await project(current, 'charge.refunded', REFUND);
    expect(result).toMatchObject({
      kind: 'membership',
      subscriptionId: 'sub_refund',
      membership: ENDED_NO_GRACE,
    });
  });

  test('stays ended with no grace when the cancellation arrives after', async () => {
    const current = subscription('canceled', invoice(500, 500));
    const result = await project(
      current,
      'customer.subscription.deleted',
      current
    );
    expect(result).toMatchObject({ membership: ENDED_NO_GRACE });
  });

  test('a canceled membership that was not refunded keeps its paid time', async () => {
    const current = subscription('canceled', invoice(500, 0));
    const result = await project(
      current,
      'customer.subscription.deleted',
      current
    );
    expect(result).toMatchObject({
      membership: { status: 'ended', periodEndMs: NOW_MS },
    });
  });
});
