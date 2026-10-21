import { describe, expect, test } from 'bun:test';
import {
  budgetRemaining,
  budgetSpent,
  burnRate,
  errorBudget,
  maxBurnRate,
} from '@pkgs/openslo-shared/burn-rate';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const arbTarget = fc.integer({ min: 50, max: 9999 }).map((n) => n / 10_000);
const arbCounts = fc
  .tuple(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 1, max: 5000 }))
  .map(([a, b]) => ({ good: Math.min(a, b), total: b }));

describe('burn rate', () => {
  test('is 1 when exactly the allowed share of events is bad', () => {
    expect(burnRate({ good: 999, total: 1000 }, 0.999)).toBeCloseTo(1, 9);
    expect(burnRate({ good: 95, total: 100 }, 0.95)).toBeCloseTo(1, 9);
  });

  test('is 0 with no bad events and unknown with no events', () => {
    expect(burnRate({ good: 10, total: 10 }, 0.99)).toBe(0);
    expect(burnRate({ good: 0, total: 0 }, 0.99)).toBeNull();
  });

  test('is infinite for any bad event against a target of 1', () => {
    expect(burnRate({ good: 9, total: 10 }, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(burnRate({ good: 10, total: 10 }, 1)).toBe(0);
  });

  test('only grows as more events go bad', () => {
    assertProperty(
      'burn is monotonic in bad events',
      fc.property(arbCounts, arbTarget, (counts, target) => {
        fc.pre(counts.good > 0);
        const worse = { good: counts.good - 1, total: counts.total };
        expect(burnRate(worse, target) ?? 0).toBeGreaterThan(
          burnRate(counts, target) ?? 0
        );
      })
    );
  });

  test('is the budget fraction spent, and never above the maximum', () => {
    assertProperty(
      'burn is bounded by 1 / budget',
      fc.property(arbCounts, arbTarget, (counts, target) => {
        const burn = burnRate(counts, target);
        expect(burn).not.toBeNull();
        expect(burn ?? 0).toBeLessThanOrEqual(maxBurnRate(target) + 1e-9);
        expect(budgetRemaining(counts, target)).toBeCloseTo(1 - (burn ?? 0), 9);
      })
    );
  });

  test('error budget and maximum burn are reciprocal', () => {
    expect(errorBudget(0.999)).toBeCloseTo(0.001, 12);
    expect(maxBurnRate(0.95)).toBeCloseTo(20, 9);
  });
});

describe('budget spent by a burn held for a while', () => {
  test.each([
    [14.4, '1h', '28d', 14.4 / 672],
    [6, '6h', '28d', 36 / 672],
    [1, '3d', '28d', 72 / 672],
    [14.4, '1h', '30d', 0.02],
    [6, '6h', '30d', 0.05],
    [1, '3d', '30d', 0.1],
  ])(
    '%px over %s of %s spends %p of the budget',
    (factor, lookback, window, spent) => {
      expect(budgetSpent({ factor, lookback, window })).toBeCloseTo(spent, 9);
    }
  );

  test('refuses a duration it cannot read', () => {
    expect(() =>
      budgetSpent({ factor: 1, lookback: 'soon', window: '28d' })
    ).toThrow('bad duration');
  });
});
