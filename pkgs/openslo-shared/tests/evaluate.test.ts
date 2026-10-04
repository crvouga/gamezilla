import { describe, expect, test } from 'bun:test';
import { evaluateObjective } from '@pkgs/openslo-shared/evaluate';
import type { Measurement } from '@pkgs/openslo-shared/evaluate';
import type { Objective, Sli, Slo } from '@pkgs/openslo-shared/model';
import {
  events,
  HOUR,
  NOW,
  objective,
  RATIO_SLI,
  slo,
  THRESHOLD_SLI,
} from './objectives';

const evaluate = (input: {
  readonly slo?: Slo;
  readonly sli?: Sli;
  readonly objective: Objective;
  readonly measurement: Measurement;
  readonly nowMs?: number;
}) =>
  evaluateObjective({
    slo: input.slo ?? slo(),
    sli: input.sli ?? RATIO_SLI,
    objective: input.objective,
    measurement: input.measurement,
    nowMs: input.nowMs ?? NOW,
  });

const samples = (values: readonly number[]): Measurement => ({
  kind: 'samples',
  samples: values.map((value, i) => ({ atMs: NOW - i * 1000, value })),
});

describe('ratio indicators', () => {
  test('good over total reaches the target', () => {
    const result = evaluate({
      objective: objective({ target: 0.9 }),
      measurement: { kind: 'events', events: events(9, 1) },
    });
    expect(result).toMatchObject({
      met: true,
      observed: 0.9,
      target: 0.9,
      considered: 10,
    });
    expect(result.detail).toContain('9/10 good events');
  });

  test('one bad event too many misses it', () => {
    const result = evaluate({
      objective: objective({ target: 0.9 }),
      measurement: { kind: 'events', events: events(8, 2) },
    });
    expect(result).toMatchObject({ met: false, observed: 0.8 });
  });

  test('a percent target is met exactly at its edge (99.9% of 1000)', () => {
    const result = evaluate({
      objective: objective({ target: 99.9 / 100 }),
      measurement: { kind: 'events', events: events(999, 1) },
    });
    expect(result.met).toBe(true);
  });
});

describe('threshold indicators', () => {
  const p95 = objective({ op: 'lt', value: 200, target: 0.95 });

  test('p95 under 200 ms holds when 95% of samples are under 200', () => {
    const values = [...Array(95).fill(120), ...Array(5).fill(900)];
    const result = evaluate({
      sli: THRESHOLD_SLI,
      objective: p95,
      measurement: samples(values),
    });
    expect(result).toMatchObject({
      met: true,
      observed: 0.95,
      considered: 100,
    });
    expect(result.detail).toContain('95/100 samples lt 200');
  });

  test('a sample at the threshold is not under it', () => {
    const values = [...Array(94).fill(120), ...Array(6).fill(200)];
    const result = evaluate({
      sli: THRESHOLD_SLI,
      objective: p95,
      measurement: samples(values),
    });
    expect(result.met).toBe(false);
  });

  test.each([
    ['lte', 200, true],
    ['gt', 199, true],
    ['gte', 201, false],
  ] as const)('op %s %d', (op, value, met) => {
    const result = evaluate({
      sli: THRESHOLD_SLI,
      objective: objective({ op, value, target: 1 }),
      measurement: samples([200, 200]),
    });
    expect(result.met).toBe(met);
  });
});

describe('the window', () => {
  const at = (atMs: number, good: boolean) => ({ atMs, good });

  test('holds events at both of its ends and nothing beyond them', () => {
    const measurement: Measurement = {
      kind: 'events',
      events: [
        at(NOW - HOUR - 1, false),
        at(NOW - HOUR, true),
        at(NOW, true),
        at(NOW + 1, false),
      ],
    };
    const result = evaluate({
      objective: objective({ target: 1 }),
      measurement,
    });
    expect(result).toMatchObject({ met: true, considered: 2 });
  });

  test('no events in the window is no evidence, not a pass', () => {
    const result = evaluate({
      objective: objective({ target: 0.5 }),
      measurement: { kind: 'events', events: [at(NOW - 2 * HOUR, true)] },
    });
    expect(result).toMatchObject({ met: false, observed: null, considered: 0 });
    expect(result.detail).toContain('no evidence');
  });

  test('a calendar window starts at its period, not one duration back', () => {
    const daily = slo({
      window: {
        duration: '1d',
        isRolling: false,
        calendar: { startTime: '2026-01-01 00:00:00', timeZone: 'UTC' },
      },
    });
    const measurement: Measurement = {
      kind: 'events',
      events: [
        at(Date.UTC(2026, 8, 27, 23), false),
        at(Date.UTC(2026, 8, 28, 1), true),
      ],
    };
    const result = evaluate({
      slo: daily,
      objective: objective({ target: 1 }),
      measurement,
    });
    expect(result).toMatchObject({ met: true, considered: 1 });
  });
});

describe('the wrong kind of measurement', () => {
  test('samples for a ratio indicator', () => {
    const result = evaluate({
      objective: objective(),
      measurement: samples([1]),
    });
    expect(result).toMatchObject({ met: false, observed: null });
    expect(result.detail).toContain(
      'is measured as events, but the measure returned samples'
    );
  });

  test('events for a threshold indicator', () => {
    const result = evaluate({
      sli: THRESHOLD_SLI,
      objective: objective({ op: 'lt', value: 1 }),
      measurement: { kind: 'events', events: events(1, 0) },
    });
    expect(result.detail).toContain(
      'is measured as samples, but the measure returned events'
    );
  });
});

describe('timeslices', () => {
  const hourly = slo({
    budgetingMethod: 'Timeslices',
    window: { duration: '4h', isRolling: true, calendar: null },
  });
  const perHour = objective({
    target: 0.75,
    timeSliceTarget: 0.9,
    timeSliceWindow: '1h',
  });
  /** `goods`/`total` events in the `slice`-th hour of the window. */
  const slice = (index: number, goods: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({
      atMs: NOW - 4 * HOUR + index * HOUR + i * 1000,
      good: i < goods,
    }));

  test('good slices over slices reach the target', () => {
    const measurement: Measurement = {
      kind: 'events',
      events: [
        ...slice(0, 10, 10),
        ...slice(1, 9, 10),
        ...slice(2, 10, 10),
        ...slice(3, 1, 10),
      ],
    };
    const result = evaluate({ slo: hourly, objective: perHour, measurement });
    expect(result).toMatchObject({ met: true, observed: 0.75, considered: 40 });
    expect(result.detail).toContain('3/4 good 1h slices');
  });

  test('a burst that spoils one more slice misses it', () => {
    const measurement: Measurement = {
      kind: 'events',
      events: [
        ...slice(0, 10, 10),
        ...slice(1, 8, 10),
        ...slice(2, 10, 10),
        ...slice(3, 1, 10),
      ],
    };
    const result = evaluate({ slo: hourly, objective: perHour, measurement });
    expect(result).toMatchObject({ met: false, observed: 0.5 });
  });

  test('an hour with no events counts neither way', () => {
    const measurement: Measurement = {
      kind: 'events',
      events: [...slice(0, 10, 10), ...slice(2, 10, 10)],
    };
    const result = evaluate({ slo: hourly, objective: perHour, measurement });
    expect(result).toMatchObject({ met: true, observed: 1 });
  });

  test('threshold samples slice the same way', () => {
    const fast = objective({
      op: 'lt',
      value: 200,
      target: 1,
      timeSliceTarget: 0.5,
      timeSliceWindow: '1h',
    });
    const measurement: Measurement = {
      kind: 'samples',
      samples: [
        { atMs: NOW - 3 * HOUR, value: 100 },
        { atMs: NOW - 3 * HOUR + 1, value: 900 },
        { atMs: NOW - HOUR, value: 150 },
      ],
    };
    const result = evaluate({
      slo: hourly,
      sli: THRESHOLD_SLI,
      objective: fast,
      measurement,
    });
    expect(result).toMatchObject({ met: true, observed: 1, considered: 3 });
  });
});
