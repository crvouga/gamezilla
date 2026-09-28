import { describe, expect, test } from 'bun:test';
import type { PlusMembershipOffer } from '@pkgs/billing';
import { CONTRACT_OFFER } from '@pkgs/billing/membership-billing-contract';
import {
  PADDLE_MEMBERSHIP_CALLBACK_EVENTS,
  PaddleApi,
  paddlePriceBody,
  reconcilePaddleOffer,
} from '@pkgs/billing-paddle';
import { FakePaddle } from '@pkgs/billing-paddle/harness';
import { createNoopLogger } from '@pkgs/logger';

const log = createNoopLogger();
const ctx = { callbackUrl: 'https://api.test/api/billing/callback/paddle' };

const OFFER: PlusMembershipOffer = {
  ...CONTRACT_OFFER,
  prices: {
    ...CONTRACT_OFFER.prices,
    subscription_monthly: {
      ...CONTRACT_OFFER.prices['subscription_monthly']!,
      currencyOptions: {
        inr: { unitAmount: 4900 },
        eur: { unitAmount: 650 },
        ngn: { unitAmount: 6600 },
      },
    },
  },
};

function open() {
  const paddle = new FakePaddle();
  const api = new PaddleApi({
    apiKey: paddle.apiKey,
    origin: paddle.origin,
    fetch: paddle.fetch,
  });
  return { paddle, api };
}

describe('paddlePriceBody', () => {
  test('the offer price in Paddle terms', () => {
    const spec = OFFER.prices['subscription_monthly']!;
    const { body, unpriced } = paddlePriceBody(OFFER, spec);
    expect(body.unit_price).toEqual({ amount: '700', currency_code: 'USD' });
    expect(body.billing_cycle).toEqual({ interval: 'month', frequency: 1 });
    expect(body.trial_period).toEqual({ interval: 'day', frequency: 7 });
    expect(body.custom_data).toEqual({
      catalog_price_id: 'subscription_monthly',
    });
    expect(body.unit_price_overrides.map((o) => o.unit_price)).toEqual([
      { amount: '650', currency_code: 'EUR' },
      { amount: '4900', currency_code: 'INR' },
    ]);
    expect(body.unit_price_overrides[1]?.country_codes).toEqual(['IN']);
    expect(unpriced).toEqual(['ngn']);
  });
});

describe('reconcilePaddleOffer', () => {
  test('creates the product, every price and the webhook destination', async () => {
    const { paddle, api } = open();
    const result = await reconcilePaddleOffer(api, OFFER, ctx, log);
    expect(paddle.products.size).toBe(1);
    expect(paddle.prices.size).toBe(2);
    expect(result.prices.map((p) => p.key)).toEqual([
      'subscription_monthly',
      'subscription_yearly',
    ]);
    const [destination] = paddle.notificationSettings.values();
    expect(destination?.destination).toBe(ctx.callbackUrl);
    expect([...(destination?.subscribed_events ?? [])].sort()).toEqual(
      Object.keys(PADDLE_MEMBERSHIP_CALLBACK_EVENTS).sort()
    );
    expect(result.newWebhookSecret).toBe(
      destination?.endpoint_secret_key ?? null
    );
    expect(result.unpricedCurrencies).toEqual(['ngn']);
  });

  test('a second run is a no-op', async () => {
    const { paddle, api } = open();
    const first = await reconcilePaddleOffer(api, OFFER, ctx, log);
    const snapshot = JSON.stringify([
      [...paddle.products.values()],
      [...paddle.prices.values()],
      [...paddle.notificationSettings.values()],
    ]);
    const second = await reconcilePaddleOffer(api, OFFER, ctx, log);
    expect(second.prices).toEqual(first.prices);
    expect(second.newWebhookSecret).toBeNull();
    expect(
      JSON.stringify([
        [...paddle.products.values()],
        [...paddle.prices.values()],
        [...paddle.notificationSettings.values()],
      ])
    ).toBe(snapshot);
  });

  test('a new amount updates the price in place', async () => {
    const { paddle, api } = open();
    const first = await reconcilePaddleOffer(api, OFFER, ctx, log);
    const cheaper: PlusMembershipOffer = {
      ...OFFER,
      prices: {
        ...OFFER.prices,
        subscription_yearly: {
          ...OFFER.prices['subscription_yearly']!,
          unitAmount: 5000,
        },
      },
    };
    const second = await reconcilePaddleOffer(api, cheaper, ctx, log);
    expect(second.prices).toEqual(first.prices);
    const yearly = paddle.prices.get(second.prices[1]?.priceId ?? '');
    expect(yearly?.unit_price.amount).toBe('5000');
  });

  test('a new billing cycle retires the old price for a new one', async () => {
    const { paddle, api } = open();
    const first = await reconcilePaddleOffer(api, OFFER, ctx, log);
    const weekly: PlusMembershipOffer = {
      ...OFFER,
      prices: {
        ...OFFER.prices,
        subscription_yearly: {
          ...OFFER.prices['subscription_yearly']!,
          interval: 'month',
        },
      },
    };
    const second = await reconcilePaddleOffer(api, weekly, ctx, log);
    const oldId = first.prices[1]?.priceId ?? '';
    expect(second.prices[1]?.priceId).not.toBe(oldId);
    expect(paddle.prices.get(oldId)?.status).toBe('archived');
  });

  test('a moved callback path moves the destination and keeps its secret', async () => {
    const { paddle, api } = open();
    const first = await reconcilePaddleOffer(
      api,
      OFFER,
      { callbackUrl: 'https://api.test/old/callback' },
      log
    );
    const second = await reconcilePaddleOffer(api, OFFER, ctx, log);
    expect(paddle.notificationSettings.size).toBe(1);
    expect(second.notificationSettingId).toBe(first.notificationSettingId);
    expect(second.newWebhookSecret).toBeNull();
    expect(
      paddle.notificationSettings.get(second.notificationSettingId)?.destination
    ).toBe(ctx.callbackUrl);
  });
});
