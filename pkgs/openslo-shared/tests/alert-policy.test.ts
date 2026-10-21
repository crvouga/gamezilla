import { describe, expect, test } from 'bun:test';
import {
  alertedObjective,
  bundleIssues,
  describeReadings,
  evaluatePolicy,
  STANDARD_BURN_TIERS,
  standardAlerts,
} from '@pkgs/openslo-shared/alert-policy';
import type { Counts } from '@pkgs/openslo-shared/burn-rate';
import { budgetSpent, maxBurnRate } from '@pkgs/openslo-shared/burn-rate';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { objective, slo } from './objectives';

const window28 = { duration: '28d', isRolling: true, calendar: null };
const served = slo({
  name: 'requests-served',
  window: window28,
  objectives: [objective({ displayName: 'nearly all', target: 0.999 })],
});
const bundle = standardAlerts({ slo: served });
const fast = bundle.policies.find((p) => p.name.endsWith('fast-burn'));
if (fast === undefined) throw new Error('no fast-burn policy');
const fastConditions = fast.conditions.flatMap((name) =>
  bundle.conditions.filter((c) => c.name === name)
);

/** Counts per window: `bad` of `total` events bad in the named windows. */
function countsFor(
  total: number,
  bad: Readonly<Record<string, number>>
): (window: string) => Counts {
  return (window) => ({ good: total - (bad[window] ?? 0), total });
}

const evaluate = (
  counts: (window: string) => Counts,
  minimumEventsPerHour = 10
) =>
  evaluatePolicy({
    policy: fast,
    conditions: fastConditions,
    target: 0.999,
    counts,
    minimumEventsPerHour,
  });

describe('the standard policies of an SLO', () => {
  test('are a fast and a slow page and a ticket, named after the SLO', () => {
    expect(bundle.policies.map((p) => p.name)).toEqual([
      'requests-served-fast-burn',
      'requests-served-slow-burn',
      'requests-served-budget-drift',
    ]);
    expect(
      bundle.conditions.map((c) => [c.severity, c.threshold, c.lookbackWindow])
    ).toEqual([
      ['page', 14.4, '1h'],
      ['page', 14.4, '5m'],
      ['page', 6, '6h'],
      ['page', 6, '30m'],
      ['ticket', 1, '3d'],
      ['ticket', 1, '6h'],
    ]);
  });

  test('look back over a long window and a twelfth of it', () => {
    for (const tier of STANDARD_BURN_TIERS) {
      const hours = (window: string) =>
        window.endsWith('m')
          ? Number.parseInt(window, 10) / 60
          : window.endsWith('d')
            ? Number.parseInt(window, 10) * 24
            : Number.parseInt(window, 10);
      expect(hours(tier.longWindow) / hours(tier.shortWindow)).toBe(12);
    }
  });

  test('spend the shares of a 28 day budget the workbook rounds to 2, 5 and 10 percent', () => {
    const spent = STANDARD_BURN_TIERS.map((tier) =>
      budgetSpent({
        factor: tier.factor,
        lookback: tier.longWindow,
        window: '28d',
      })
    );
    expect(spent.map((s) => Math.round(s * 1000) / 10)).toEqual([
      2.1, 5.4, 10.7,
    ]);
  });

  test('can all fire for the objectives the product states', () => {
    for (const target of [0.95, 0.99, 0.999]) {
      const one = slo({
        window: window28,
        objectives: [objective({ target })],
      });
      expect(bundleIssues(one, standardAlerts({ slo: one }))).toEqual([]);
    }
  });

  test('are refused when no event mix could ever fire them', () => {
    const lax = slo({
      name: 'lax',
      window: window28,
      objectives: [objective({ target: 0.9 })],
    });
    const issues = bundleIssues(lax, standardAlerts({ slo: lax }));
    expect(maxBurnRate(0.9)).toBeCloseTo(10, 9);
    expect(issues.some((i) => i.includes('14.4x can never be reached'))).toBe(
      true
    );
  });

  test('are refused when they look back further than the window', () => {
    const short = slo({
      name: 'short',
      window: { duration: '2d', isRolling: true, calendar: null },
      objectives: [objective({ target: 0.99 })],
    });
    const issues = bundleIssues(short, standardAlerts({ slo: short }));
    expect(issues.some((i) => i.includes('looks back 3d'))).toBe(true);
  });

  test('lack a page or a ticket when a tier is left out', () => {
    const onlyPages = standardAlerts({
      slo: served,
      tiers: STANDARD_BURN_TIERS.filter((t) => t.severity === 'page'),
    });
    expect(bundleIssues(served, onlyPages)).toContain(
      'SLO requests-served has no ticket alert'
    );
  });

  test('defend exactly one objective', () => {
    expect(() => alertedObjective(slo({ objectives: [] }))).toThrow(
      'exactly one'
    );
  });
});

describe('judging a policy', () => {
  test('fires only while the long and the short window both burn fast', () => {
    const burning = evaluate(countsFor(10_000, { '1h': 200, '5m': 200 }));
    expect(burning.state).toBe('firing');
    const recovered = evaluate(countsFor(10_000, { '1h': 200, '5m': 0 }));
    expect(recovered.state).toBe('quiet');
    const blip = evaluate(countsFor(10_000, { '1h': 5, '5m': 200 }));
    expect(blip.state).toBe('quiet');
  });

  // regression: burn-rate-threshold-float-boundary
  test('holds at exactly the threshold', () => {
    // 14.4 x 0.1 % = 1.44 % bad; 144 / 10000 / 0.001 is 14.399999999999999
    expect(evaluate(countsFor(10_000, { '1h': 144, '5m': 144 })).state).toBe(
      'firing'
    );
    expect(evaluate(countsFor(10_000, { '1h': 143, '5m': 143 })).state).toBe(
      'quiet'
    );
  });

  test('says there is nothing to judge when the longest window saw nothing', () => {
    const none = (): Counts => ({ good: 0, total: 0 });
    expect(evaluate(none).state).toBe('no-data');
  });

  test('stays quiet, and says why, when traffic is too thin to judge', () => {
    // One hour at 10 events an hour needs 10; 5 is too few whatever failed.
    const thin = evaluate(countsFor(5, { '1h': 5, '5m': 5 }));
    expect(thin.state).toBe('low-traffic');
  });

  test('describes each window with its burn, limit and event count', () => {
    const text = describeReadings(
      evaluate(countsFor(10_000, { '1h': 200, '5m': 100 })).readings,
      0.999
    );
    expect(text).toContain('20x over 1h (limit 14.4x, 10000 events)');
    expect(text).toContain('10x over 5m');
    expect(text).toContain('allows 0.1% bad events');
  });

  test('fires when every window is at least the threshold, whatever the mix', () => {
    assertProperty(
      'firing iff all conditions hold',
      fc.property(
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 0, max: 400 }),
        (bad1h, bad5m) => {
          const result = evaluate(
            countsFor(10_000, { '1h': bad1h, '5m': bad5m })
          );
          const holds = (bad: number) => bad / 10_000 / 0.001 >= 14.4;
          expect(result.state === 'firing').toBe(holds(bad1h) && holds(bad5m));
        }
      )
    );
  });
});
