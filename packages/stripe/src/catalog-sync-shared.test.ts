import { describe, expect, it } from 'bun:test';
import {
  decidePriceReconcile,
  normalizeCurrencyOptions,
  priceMatchesSpec,
  type PriceSpecEntry,
} from './catalog-sync-shared';

const monthlySpec: PriceSpecEntry = {
  product: 'subscription',
  lookup_key: 'subscription_monthly',
  unit_amount: 700,
  currency: 'usd',
  recurring: { interval: 'month' },
  currency_options: {
    inr: { unit_amount: 29_900 },
    brl: { unit_amount: 1990 },
  },
};

describe('normalizeCurrencyOptions', () => {
  it('lowercases keys and extracts unit_amount', () => {
    expect(
      normalizeCurrencyOptions({
        INR: { unit_amount: 100 },
        brl: { unit_amount: 200 },
      })
    ).toEqual({ inr: 100, brl: 200 });
  });
});

const prodId = 'prod_catalog_subscription';

describe('priceMatchesSpec', () => {
  it('returns true when live matches spec', () => {
    const ok = priceMatchesSpec(
      {
        unit_amount: 700,
        currency: 'usd',
        recurring: { interval: 'month' },
        active: true,
        product: prodId,
        currency_options: {
          inr: { unit_amount: 29_900 },
          brl: { unit_amount: 1990 },
        },
      },
      monthlySpec,
      prodId
    );
    expect(ok).toBe(true);
  });

  it('returns true when Stripe has extra currency_options not in spec', () => {
    const ok = priceMatchesSpec(
      {
        unit_amount: 700,
        currency: 'usd',
        recurring: { interval: 'month' },
        active: true,
        product: prodId,
        currency_options: {
          inr: { unit_amount: 29_900 },
          brl: { unit_amount: 1990 },
          eur: { unit_amount: 600 },
        },
      },
      monthlySpec,
      prodId
    );
    expect(ok).toBe(true);
  });

  it('returns false when currency_options drift', () => {
    const ok = priceMatchesSpec(
      {
        unit_amount: 700,
        currency: 'usd',
        recurring: { interval: 'month' },
        active: true,
        product: prodId,
        currency_options: {
          inr: { unit_amount: 29_901 },
          brl: { unit_amount: 1990 },
        },
      },
      monthlySpec,
      prodId
    );
    expect(ok).toBe(false);
  });

  it('returns false when product id does not match', () => {
    const ok = priceMatchesSpec(
      {
        unit_amount: 700,
        currency: 'usd',
        recurring: { interval: 'month' },
        active: true,
        product: 'prod_other',
        currency_options: {
          inr: { unit_amount: 29_900 },
          brl: { unit_amount: 1990 },
        },
      },
      monthlySpec,
      prodId
    );
    expect(ok).toBe(false);
  });

  it('returns true when spec trial matches live trial', () => {
    const trialSpec: PriceSpecEntry = {
      ...monthlySpec,
      recurring: { interval: 'month', trial_period_days: 7 },
    };
    const ok = priceMatchesSpec(
      {
        unit_amount: 700,
        currency: 'usd',
        recurring: { interval: 'month', trial_period_days: 7 },
        active: true,
        product: prodId,
        currency_options: {
          inr: { unit_amount: 29_900 },
          brl: { unit_amount: 1990 },
        },
      },
      trialSpec,
      prodId
    );
    expect(ok).toBe(true);
  });

  it('returns false when spec declares trial but live has none', () => {
    const trialSpec: PriceSpecEntry = {
      ...monthlySpec,
      recurring: { interval: 'month', trial_period_days: 7 },
    };
    const ok = priceMatchesSpec(
      {
        unit_amount: 700,
        currency: 'usd',
        recurring: { interval: 'month', trial_period_days: null },
        active: true,
        product: prodId,
        currency_options: {
          inr: { unit_amount: 29_900 },
          brl: { unit_amount: 1990 },
        },
      },
      trialSpec,
      prodId
    );
    expect(ok).toBe(false);
  });

  it('returns false when spec has no trial but live has one', () => {
    const ok = priceMatchesSpec(
      {
        unit_amount: 700,
        currency: 'usd',
        recurring: { interval: 'month', trial_period_days: 7 },
        active: true,
        product: prodId,
        currency_options: {
          inr: { unit_amount: 29_900 },
          brl: { unit_amount: 1990 },
        },
      },
      monthlySpec,
      prodId
    );
    expect(ok).toBe(false);
  });

  it('returns false when trial day counts drift', () => {
    const trialSpec: PriceSpecEntry = {
      ...monthlySpec,
      recurring: { interval: 'month', trial_period_days: 7 },
    };
    const ok = priceMatchesSpec(
      {
        unit_amount: 700,
        currency: 'usd',
        recurring: { interval: 'month', trial_period_days: 14 },
        active: true,
        product: prodId,
        currency_options: {
          inr: { unit_amount: 29_900 },
          brl: { unit_amount: 1990 },
        },
      },
      trialSpec,
      prodId
    );
    expect(ok).toBe(false);
  });
});

describe('decidePriceReconcile', () => {
  it('returns replace when no live price', () => {
    expect(decidePriceReconcile(null, null, monthlySpec, prodId)).toBe(
      'replace'
    );
  });

  it('returns noop when live matches', () => {
    expect(
      decidePriceReconcile(
        { id: 'price_1' },
        {
          unit_amount: 700,
          currency: 'usd',
          recurring: { interval: 'month' },
          active: true,
          product: prodId,
          currency_options: {
            inr: { unit_amount: 29_900 },
            brl: { unit_amount: 1990 },
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
          unit_amount: 800,
          currency: 'usd',
          recurring: { interval: 'month' },
          active: true,
          product: prodId,
          currency_options: {},
        },
        monthlySpec,
        prodId
      )
    ).toBe('replace');
  });

  it('returns replace when trial drifts from spec', () => {
    const trialSpec: PriceSpecEntry = {
      ...monthlySpec,
      recurring: { interval: 'month', trial_period_days: 7 },
    };
    expect(
      decidePriceReconcile(
        { id: 'price_1' },
        {
          unit_amount: 700,
          currency: 'usd',
          recurring: { interval: 'month', trial_period_days: null },
          active: true,
          product: prodId,
          currency_options: {
            inr: { unit_amount: 29_900 },
            brl: { unit_amount: 1990 },
          },
        },
        trialSpec,
        prodId
      )
    ).toBe('replace');
  });
});
