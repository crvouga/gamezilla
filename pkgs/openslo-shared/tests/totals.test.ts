import { describe, expect, test } from 'bun:test';
import type { Measurement } from '@pkgs/openslo-shared/evaluate';
import { evaluateObjective } from '@pkgs/openslo-shared/evaluate';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import {
  events,
  NOW,
  objective,
  RATIO_SLI,
  slo,
  THRESHOLD_SLI,
} from './objectives';

const evaluate = (
  measurement: Measurement,
  target = 0.99,
  method: 'Occurrences' | 'Timeslices' = 'Occurrences'
) =>
  evaluateObjective({
    slo: slo({ budgetingMethod: method }),
    sli: RATIO_SLI,
    objective:
      method === 'Timeslices'
        ? objective({ target, timeSliceTarget: 0.9, timeSliceWindow: '10m' })
        : objective({ target }),
    measurement,
    nowMs: NOW,
  });

describe('a measurement counted by the backend', () => {
  test('is met exactly when good over total reaches the target', () => {
    expect(evaluate({ kind: 'totals', good: 990, total: 1000 }).met).toBe(true);
    expect(evaluate({ kind: 'totals', good: 989, total: 1000 }).met).toBe(
      false
    );
  });

  test('reports what it observed and over which window', () => {
    const result = evaluate({ kind: 'totals', good: 98, total: 100 }, 0.99);
    expect(result).toMatchObject({
      met: false,
      observed: 0.98,
      considered: 100,
    });
    expect(result.detail).toContain('98/100 good events');
  });

  test('with no events at all is no evidence, never a pass', () => {
    const result = evaluate({ kind: 'totals', good: 0, total: 0 });
    expect(result.met).toBe(false);
    expect(result.detail).toContain('no evidence');
  });

  test.each([
    [-1, 10],
    [11, 10],
    [Number.NaN, 10],
    [5, Number.POSITIVE_INFINITY],
  ])('rejects the impossible totals %p of %p', (good, total) => {
    const result = evaluate({ kind: 'totals', good, total });
    expect(result.met).toBe(false);
    expect(result.detail).toContain('invalid totals');
  });

  test('cannot judge slices, which need the events times', () => {
    const result = evaluate(
      { kind: 'totals', good: 100, total: 100 },
      0.9,
      'Timeslices'
    );
    expect(result.met).toBe(false);
    expect(result.detail).toContain('Occurrences');
  });

  test('cannot judge a threshold indicator', () => {
    const result = evaluateObjective({
      slo: slo(),
      sli: THRESHOLD_SLI,
      objective: objective({ op: 'lt', value: 5 }),
      measurement: { kind: 'totals', good: 10, total: 10 },
      nowMs: NOW,
    });
    expect(result.met).toBe(false);
    expect(result.detail).toContain('measured as samples');
  });

  test('agrees with the same events counted one by one', () => {
    assertProperty(
      'totals equal events',
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 100 }).map((n) => n / 100),
        (goods, bads, target) => {
          const byEvents = evaluate(
            { kind: 'events', events: events(goods, bads) },
            target
          );
          const byTotals = evaluate(
            { kind: 'totals', good: goods, total: goods + bads },
            target
          );
          expect(byTotals.met).toBe(byEvents.met);
          expect(byTotals.observed).toBe(byEvents.observed);
        }
      )
    );
  });
});
