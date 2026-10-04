import { expect, test } from 'bun:test';
import { CONTRACT_OFFER } from '@pkgs/billing-shared/contract-fixtures';
import { PaddleMembershipBilling } from '@pkgs/billing-paddle-shared/paddle-membership';
import { signPaddlePayload } from '@pkgs/billing-paddle-shared/signature';

test('a signed completed payment reaches the payment evidence handler', async () => {
  // regression: paddle-completed-payment-ignored
  const now = 1_800_000_000_000;
  const rawBody = JSON.stringify({
    event_id: 'evt_payment',
    event_type: 'transaction.completed',
    occurred_at: '2027-01-15T08:00:00.000Z',
    data: { id: 'txn_paid', customer_id: 'ctm_alice' },
  });
  const billing = new PaddleMembershipBilling({
    apiKey: 'test',
    webhookSecret: 'secret',
    offer: CONTRACT_OFFER,
    now: () => now,
    fetch: async () => {
      throw new Error('Payment callbacks must not read a subscription');
    },
  });
  const headers = new Headers({
    'paddle-signature': signPaddlePayload({
      secret: 'secret',
      payload: rawBody,
      timestampS: now / 1000,
    }),
  });
  expect(await billing.readCallback({ rawBody, headers })).toEqual({
    kind: 'payments',
    provider: 'paddle',
    customerId: 'ctm_alice',
  });
});
