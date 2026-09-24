import { describe, expect, test } from 'bun:test';
import {
  RELATIVE_TIME_TICK_MS,
  relativeTimeParts,
} from '@pkgs/ui/components/relative-time';

const T0 = Date.UTC(2024, 0, 1, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

describe('relativeTimeParts', () => {
  test('sub-minute and future differences are "just now"', () => {
    expect(relativeTimeParts(iso(T0), T0)).toEqual({ kind: 'justNow' });
    expect(relativeTimeParts(iso(T0 - 59_000), T0)).toEqual({
      kind: 'justNow',
    });
    expect(relativeTimeParts(iso(T0 + 60_000 * 10), T0)).toEqual({
      kind: 'justNow',
    });
  });

  test('buckets minutes, hours and days (floored)', () => {
    expect(relativeTimeParts(iso(T0 - 60_000), T0)).toEqual({
      kind: 'minutes',
      value: 1,
    });
    expect(relativeTimeParts(iso(T0 - 59 * 60_000), T0)).toEqual({
      kind: 'minutes',
      value: 59,
    });
    expect(relativeTimeParts(iso(T0 - 60 * 60_000), T0)).toEqual({
      kind: 'hours',
      value: 1,
    });
    expect(relativeTimeParts(iso(T0 - 23.9 * 3_600_000), T0)).toEqual({
      kind: 'hours',
      value: 23,
    });
    expect(relativeTimeParts(iso(T0 - 24 * 3_600_000), T0)).toEqual({
      kind: 'days',
      value: 1,
    });
    expect(relativeTimeParts(iso(T0 - 10 * 86_400_000), T0)).toEqual({
      kind: 'days',
      value: 10,
    });
  });

  test('unparseable input is echoed raw; blank input is "just now"', () => {
    expect(relativeTimeParts('  soon  ', T0)).toEqual({
      kind: 'raw',
      value: 'soon',
    });
    expect(relativeTimeParts('   ', T0)).toEqual({ kind: 'justNow' });
  });

  test('tick interval is a positive sub-minute cadence', () => {
    expect(RELATIVE_TIME_TICK_MS).toBeGreaterThan(0);
    expect(RELATIVE_TIME_TICK_MS).toBeLessThanOrEqual(60_000);
  });
});
