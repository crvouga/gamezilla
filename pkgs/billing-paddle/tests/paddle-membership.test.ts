import { describe, expect, test } from 'bun:test';
import type { MembershipStatus } from '@pkgs/billing';
import { CONTRACT_OFFER } from '@pkgs/billing/membership-billing-contract';
import {
  membershipStatusOf,
  PaddleMembershipBilling,
  paddleOriginForApiKey,
  signPaddlePayload,
  verifyPaddleSignature,
} from '@pkgs/billing-paddle';
import { FakePaddle } from '@pkgs/billing-paddle/harness';
import { assertProperty } from '@pkgs/property';
import fc from 'fast-check';

const NOW = 1_800_000_000_000;
const RETURN_URL = 'https://app.test/more/billing';

function open(checkoutUrl: string | null = null) {
  const paddle = new FakePaddle();
  for (const spec of Object.values(CONTRACT_OFFER.prices)) {
    paddle.seedPrice(spec.catalogPriceId);
  }
  const billing = new PaddleMembershipBilling({
    apiKey: paddle.apiKey,
    webhookSecret: paddle.webhookSecret,
    offer: CONTRACT_OFFER,
    now: () => NOW,
    fetch: paddle.fetch,
    origin: paddle.origin,
    checkoutUrl,
  });
  return { paddle, billing };
}

describe('membershipStatusOf', () => {
  test('maps every Paddle subscription status onto ours', () => {
    const cases: ReadonlyArray<readonly [string, MembershipStatus]> = [
      ['trialing', 'trialing'],
      ['active', 'active'],
      ['past_due', 'delinquent'],
      ['paused', 'ended'],
      ['canceled', 'ended'],
      ['some_future_status', 'ended'],
    ];
    for (const [paddleStatus, expected] of cases) {
      expect(membershipStatusOf(paddleStatus)).toBe(expected);
    }
  });
});

describe('Paddle signatures', () => {
  test('a signature verifies only for its secret, body and time', () => {
    assertProperty(
      'a signature verifies only for its secret, body and time',
      fc.property(
        fc.string(),
        fc.integer({ min: 1_600_000_000, max: 2_000_000_000 }),
        fc.integer({ min: -10, max: 10 }),
        (payload, ts, skewS) => {
          const header = signPaddlePayload({
            secret: 's',
            payload,
            timestampS: ts,
          });
          const at = (ts + skewS) * 1000;
          expect(
            verifyPaddleSignature({ secret: 's', payload, header, nowMs: at })
          ).toBe(Math.abs(skewS) <= 5);
          expect(
            verifyPaddleSignature({
              secret: 't',
              payload,
              header,
              nowMs: ts * 1000,
            })
          ).toBe(false);
          expect(
            verifyPaddleSignature({
              secret: 's',
              payload: `${payload}x`,
              header,
              nowMs: ts * 1000,
            })
          ).toBe(false);
        }
      )
    );
  });

  test('any h1 may match, so a secret can roll', () => {
    const good = signPaddlePayload({
      secret: 'new',
      payload: 'b',
      timestampS: 100,
    });
    const stale = signPaddlePayload({
      secret: 'old',
      payload: 'b',
      timestampS: 100,
    });
    const header = `${stale};${good.split(';')[1] ?? ''}`;
    expect(
      verifyPaddleSignature({
        secret: 'new',
        payload: 'b',
        header,
        nowMs: 100_000,
      })
    ).toBe(true);
  });

  test('a malformed header never verifies', () => {
    for (const header of ['', 'ts=abc;h1=00', 'h1=00', 'ts=100', 'garbage']) {
      expect(
        verifyPaddleSignature({
          secret: 's',
          payload: 'b',
          header,
          nowMs: 100_000,
        })
      ).toBe(false);
    }
  });
});

describe('PaddleMembershipBilling', () => {
  test('keys pick their origin', () => {
    expect(paddleOriginForApiKey('pdl_sdbx_apikey_x')).toBe(
      'https://sandbox-api.paddle.com'
    );
    expect(paddleOriginForApiKey('pdl_live_apikey_x')).toBe(
      'https://api.paddle.com'
    );
  });

  test('checkout mints a customer with the email and stamps the account', async () => {
    const { paddle, billing } = open();
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: 'one@people.test',
      returnUrl: RETURN_URL,
    });
    const customer = paddle.customers.get(result.customerId);
    expect(customer?.email).toBe('one@people.test');
    expect(customer?.custom_data).toEqual({ account_id: 'acct-1' });
    const [transaction] = paddle.transactions;
    expect(transaction?.customerId).toBe(result.customerId);
    expect(transaction?.customData).toEqual({ account_id: 'acct-1' });
    expect(result.url).toBe(
      `https://pay.example.test/checkout?_ptxn=${transaction?.id ?? ''}`
    );
  });

  test('a hosted checkout link carries the transaction', async () => {
    const { paddle, billing } = open(
      'https://pay.paddle.test/hsc_01abc?locale=en'
    );
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: 'one@people.test',
      returnUrl: RETURN_URL,
    });
    const id = paddle.transactions[0]?.id ?? '';
    expect(result.url).toBe(
      `https://pay.paddle.test/hsc_01abc?locale=en&transaction_id=${id}`
    );
  });

  test('an email Paddle already knows reuses its customer', async () => {
    const { paddle, billing } = open();
    const first = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: 'one@people.test',
      returnUrl: RETURN_URL,
    });
    // The link was lost on our side; Paddle still has the customer.
    const again = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: 'one@people.test',
      returnUrl: RETURN_URL,
    });
    expect(again.customerId).toBe(first.customerId);
    expect(paddle.customers.size).toBe(1);
  });

  test('without an email there is no customer to mint', async () => {
    const { paddle, billing } = open();
    await expect(
      billing.startCheckout({
        accountId: 'acct-1',
        customerId: null,
        email: null,
        returnUrl: RETURN_URL,
      })
    ).rejects.toThrow('a customer needs an email');
    expect(paddle.transactions).toEqual([]);
  });

  test('prices are found across pages', async () => {
    const paddle = new FakePaddle();
    for (let i = 0; i < 450; i += 1) paddle.seedPrice(`filler_${String(i)}`);
    for (const spec of Object.values(CONTRACT_OFFER.prices)) {
      paddle.seedPrice(spec.catalogPriceId);
    }
    const billing = new PaddleMembershipBilling({
      apiKey: paddle.apiKey,
      webhookSecret: null,
      offer: CONTRACT_OFFER,
      now: () => NOW,
      fetch: paddle.fetch,
      origin: paddle.origin,
    });
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: 'one@people.test',
      returnUrl: RETURN_URL,
    });
    expect(result.url.length).toBeGreaterThan(0);
  });

  test('a wrong API key is an error, not a missing object', async () => {
    const paddle = new FakePaddle();
    const billing = new PaddleMembershipBilling({
      apiKey: 'pdl_sdbx_apikey_wrong',
      webhookSecret: null,
      offer: CONTRACT_OFFER,
      now: () => NOW,
      fetch: paddle.fetch,
      origin: paddle.origin,
    });
    await expect(
      billing.openPortal({
        accountId: 'acct-1',
        customerId: 'ctm_1',
        returnUrl: RETURN_URL,
      })
    ).rejects.toThrow('HTTP 403');
  });

  test('callbacks fail closed without a webhook secret', async () => {
    const paddle = new FakePaddle();
    const billing = new PaddleMembershipBilling({
      apiKey: paddle.apiKey,
      webhookSecret: null,
      offer: CONTRACT_OFFER,
      now: () => NOW,
      fetch: paddle.fetch,
      origin: paddle.origin,
    });
    const delivery = paddle.webhook({
      eventType: 'subscription.updated',
      subscriptionId: 'sub_1',
      timestampS: NOW / 1000,
    });
    expect((await billing.readCallback(delivery)).kind).toBe('unverified');
  });
});
