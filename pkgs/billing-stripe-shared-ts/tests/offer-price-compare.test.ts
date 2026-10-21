import { describe, expect, it } from 'bun:test';
import type { OfferPriceSpec } from '@pkgs/billing-root-shared-ts/offer';
import {
  decidePriceReconcile,
  normalizeCurrencyOptions,
  normalizeSnakeCurrencyOptions,
  priceMatchesSpec,
} from '@pkgs/billing-stripe-shared-ts/offer-price-compare';

const monthlySpec: OfferPriceSpec = {
  key: 'subscription_monthly',
  catalogPriceId: 'subscription_monthly',
  unitAmount: 700,
  currency: 'usd',
  interval: 'month',
  currencyOptions: {
    inr: { unitAmount: 29_900 },
    brl: { unitAmount: 1990 },
  },
};

const prodId = 'prod_catalog_subscription';

describe('normalizeCurrencyOptions', () => {
  it('lowercases keys and extracts unitAmount', () => {
    expect(
      normalizeCurrencyOptions({
        INR: { unitAmount: 100 },
        brl: { unitAmount: 200 },
      })
    ).toEqual({ inr: 100, brl: 200 });
  });
});

describe('normalizeSnakeCurrencyOptions', () => {
  it('reads the snake_case wire shape', () => {
    expect(
      normalizeSnakeCurrencyOptions({
        INR: { unit_amount: 100 },
        brl: { unit_amount: 200 },
      })
    ).toEqual({ inr: 100, brl: 200 });
  });
});

describe('priceMatchesSpec', () => {
  it('returns true when live matches spec', () => {
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          interval: 'month',
          trialPeriodDays: null,
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe(true);
  });

  it('tolerates provider-only extra currency options', () => {
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          interval: 'month',
          trialPeriodDays: null,
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
            jpy: { unitAmount: 900 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe(true);
  });

  it('returns false when a spec currency drifts', () => {
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          interval: 'month',
          trialPeriodDays: null,
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 1 },
            brl: { unitAmount: 1990 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe(false);
  });

  it('returns false when the product differs', () => {
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          interval: 'month',
          trialPeriodDays: null,
          active: true,
          product: 'prod_other',
          currencyOptions: {},
        },
        monthlySpec,
        prodId
      )
    ).toBe(false);
  });

  it('matches a declared trial period', () => {
    const withTrial: OfferPriceSpec = { ...monthlySpec, trialPeriodDays: 7 };
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          interval: 'month',
          trialPeriodDays: 7,
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        withTrial,
        prodId
      )
    ).toBe(true);
  });

  it('returns false when a declared trial is absent live', () => {
    const withTrial: OfferPriceSpec = { ...monthlySpec, trialPeriodDays: 7 };
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          interval: 'month',
          trialPeriodDays: null,
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        withTrial,
        prodId
      )
    ).toBe(false);
  });
});

describe('decidePriceReconcile', () => {
  it('replaces when there is no live price', () => {
    expect(
      decidePriceReconcile(undefined, undefined, monthlySpec, prodId)
    ).toBe('replace');
  });

  it('noops when live matches spec', () => {
    expect(
      decidePriceReconcile(
        { id: 'price_1' },
        {
          unitAmount: 700,
          currency: 'usd',
          interval: 'month',
          trialPeriodDays: null,
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe('noop');
  });

  it('returns replace when live mismatches', () => {
    expect(
      decidePriceReconcile(
        { id: 'price_1' },
        {
          unitAmount: 800,
          currency: 'usd',
          interval: 'month',
          trialPeriodDays: null,
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe('replace');
  });
});
