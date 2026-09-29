import { describe, expect, test } from 'bun:test';
import { evaluateObjective, type Measurement } from '@pkgs/openslo/evaluate';
import type { Objective, Slo } from '@pkgs/openslo/model';
import { assertProperty, fc } from '@pkgs/property';
import {
  HOUR,
  NOW,
  objective,
  RATIO_SLI,
  slo,
  THRESHOLD_SLI,
} from './support/objectives';

/** Events spread over a little more than the 4 h window, so some fall outside. */
const arbEvents = fc.array(
  fc.record({
    atMs: fc.integer({ min: NOW - 5 * HOUR, max: NOW + HOUR }),
    good: fc.boolean(),
  }),
  { maxLength: 60 }
);

const arbTarget = fc.integer({ min: 1, max: 100 }).map((n) => n / 100);

const occurrences = slo({
  window: { duration: '4h', isRolling: true, calendar: null },
});
const timeslices = slo({
  budgetingMethod: 'Timeslices',
  window: { duration: '4h', isRolling: true, calendar: null },
});

const arbCase = fc.record({
  events: arbEvents,
  target: arbTarget,
  sliceTarget: arbTarget,
  sliced: fc.boolean(),
});

type Case = {
  readonly events: readonly { readonly atMs: number; readonly good: boolean }[];
  readonly target: number;
  readonly sliceTarget: number;
  readonly sliced: boolean;
};

function ratioOf(c: Case): {
  readonly slo: Slo;
  readonly objective: Objective;
} {
  return c.sliced
    ? {
        slo: timeslices,
        objective: objective({
          target: c.target,
          timeSliceTarget: c.sliceTarget,
          timeSliceWindow: '30m',
        }),
      }
    : { slo: occurrences, objective: objective({ target: c.target }) };
}

const evaluate = (c: Case, events: Case['events']) =>
  evaluateObjective({
    ...ratioOf(c),
    sli: RATIO_SLI,
    measurement: { kind: 'events', events },
    nowMs: NOW,
  });

describe('evaluation', () => {
  test('does not depend on the order events arrive in', () => {
    assertProperty(
      'order invariance',
      fc.property(
        arbCase.chain((c) =>
          fc.tuple(
            fc.constant(c),
            fc.shuffledSubarray([...c.events], { minLength: c.events.length })
          )
        ),
        ([c, shuffled]) => {
          expect(evaluate(c, shuffled)).toEqual(evaluate(c, c.events));
        }
      )
    );
  });

  test('turning a bad event good never breaks a met objective', () => {
    assertProperty(
      'monotone in good events',
      fc.property(
        arbCase.chain((c) =>
          fc.tuple(
            fc.constant(c),
            fc.nat({ max: Math.max(0, c.events.length - 1) })
          )
        ),
        ([c, index]) => {
          const before = evaluate(c, c.events);
          const improved = c.events.map((e, i) =>
            i === index ? { ...e, good: true } : e
          );
          const after = evaluate(c, improved);
          if (before.met) expect(after.met).toBe(true);
          if (before.observed !== null && after.observed !== null) {
            expect(after.observed).toBeGreaterThanOrEqual(before.observed);
          }
        }
      )
    );
  });

  test('a threshold objective agrees with the ratio of samples it would call good', () => {
    assertProperty(
      'threshold is a ratio of good samples',
      fc.property(
        fc.array(
          fc.record({
            atMs: fc.integer({ min: NOW - 5 * HOUR, max: NOW }),
            value: fc.integer({ min: 0, max: 400 }),
          }),
          { maxLength: 40 }
        ),
        arbTarget,
        (samples, target) => {
          const measurement: Measurement = { kind: 'samples', samples };
          const threshold = evaluateObjective({
            slo: occurrences,
            sli: THRESHOLD_SLI,
            objective: objective({ op: 'lt', value: 200, target }),
            measurement,
            nowMs: NOW,
          });
          const ratio = evaluateObjective({
            slo: occurrences,
            sli: RATIO_SLI,
            objective: objective({ target }),
            measurement: {
              kind: 'events',
              events: samples.map((s) => ({
                atMs: s.atMs,
                good: s.value < 200,
              })),
            },
            nowMs: NOW,
          });
          expect([
            threshold.met,
            threshold.observed,
            threshold.considered,
          ]).toEqual([ratio.met, ratio.observed, ratio.considered]);
        }
      )
    );
  });
});
