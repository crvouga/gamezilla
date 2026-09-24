import { describe, expect, test } from 'bun:test';
import { type QuotaGrant, quotaWindowBounds } from '@pkgs/permissions';
import { assertProperty } from '@pkgs/property';
import fc from 'fast-check';

const HOUR = 3_600_000;
const NY = 'America/New_York';

function bounds(grant: QuotaGrant, iso: string, timeZone?: string) {
  return quotaWindowBounds({
    grant,
    nowMs: Date.parse(iso),
    ...(timeZone === undefined ? {} : { timeZone }),
  });
}

const localDay: QuotaGrant = {
  limit: 5,
  window: 'day',
  resetBoundary: 'userLocalMidnight',
};

describe('quotaWindowBounds', () => {
  test('utc day / week (ISO Monday) / month', () => {
    expect(bounds({ limit: 1, window: 'day' }, '2026-09-19T23:59:59Z')).toEqual(
      {
        startMs: Date.parse('2026-09-19T00:00:00Z'),
        resetsAtMs: Date.parse('2026-09-20T00:00:00Z'),
      }
    );
    // 2026-09-19 is a Saturday.
    expect(
      bounds({ limit: 1, window: 'week' }, '2026-09-19T10:00:00Z')
    ).toEqual({
      startMs: Date.parse('2026-09-14T00:00:00Z'),
      resetsAtMs: Date.parse('2026-09-21T00:00:00Z'),
    });
    expect(
      bounds({ limit: 1, window: 'month' }, '2026-12-31T10:00:00Z')
    ).toEqual({
      startMs: Date.parse('2026-12-01T00:00:00Z'),
      resetsAtMs: Date.parse('2027-01-01T00:00:00Z'),
    });
  });

  test('rolling24h and lifetime', () => {
    const now = Date.parse('2026-09-19T10:00:00Z');
    expect(
      quotaWindowBounds({
        grant: { limit: 1, window: 'rolling24h' },
        nowMs: now,
      })
    ).toEqual({ startMs: now - 24 * HOUR, resetsAtMs: now + 24 * HOUR });
    expect(
      quotaWindowBounds({ grant: { limit: 1, window: 'lifetime' }, nowMs: now })
    ).toEqual({ startMs: 0, resetsAtMs: null });
  });

  test('userLocalMidnight in New York, standard and daylight time', () => {
    expect(bounds(localDay, '2026-01-15T03:00:00Z', NY)).toEqual({
      startMs: Date.parse('2026-01-14T05:00:00Z'),
      resetsAtMs: Date.parse('2026-01-15T05:00:00Z'),
    });
    expect(bounds(localDay, '2026-07-15T12:00:00Z', NY)).toEqual({
      startMs: Date.parse('2026-07-15T04:00:00Z'),
      resetsAtMs: Date.parse('2026-07-16T04:00:00Z'),
    });
  });

  test('DST spring-forward day (2026-03-08) is 23 h long', () => {
    const b = bounds(localDay, '2026-03-08T12:00:00Z', NY);
    expect(b.startMs).toBe(Date.parse('2026-03-08T05:00:00Z'));
    expect(b.resetsAtMs).toBe(Date.parse('2026-03-09T04:00:00Z'));
    expect((b.resetsAtMs ?? 0) - b.startMs).toBe(23 * HOUR);
  });

  test('DST fall-back day (2026-11-01) is 25 h long', () => {
    const b = bounds(localDay, '2026-11-01T12:00:00Z', NY);
    expect(b.startMs).toBe(Date.parse('2026-11-01T04:00:00Z'));
    expect(b.resetsAtMs).toBe(Date.parse('2026-11-02T05:00:00Z'));
    expect((b.resetsAtMs ?? 0) - b.startMs).toBe(25 * HOUR);
  });

  test('no known zone falls back to UTC midnight; utcMidnight ignores the zone', () => {
    expect(bounds(localDay, '2026-07-15T12:00:00Z').startMs).toBe(
      Date.parse('2026-07-15T00:00:00Z')
    );
    expect(
      bounds({ limit: 1, window: 'day' }, '2026-07-15T02:00:00Z', NY).startMs
    ).toBe(Date.parse('2026-07-15T00:00:00Z'));
  });

  test('property: every instant lies in [start, reset) and reset is the next start', () => {
    const zones = [
      'UTC',
      NY,
      'Europe/London',
      'Asia/Kolkata',
      'Australia/Lord_Howe',
    ];
    assertProperty(
      'property: every instant lies in [start, reset) and reset is the next start',
      fc.property(
        fc.integer({
          min: Date.parse('2025-01-01'),
          max: Date.parse('2028-01-01'),
        }),
        fc.constantFrom(...zones),
        fc.constantFrom('day', 'week', 'month') as fc.Arbitrary<
          'day' | 'week' | 'month'
        >,
        (nowMs, timeZone, window) => {
          const grant: QuotaGrant = {
            limit: 1,
            window,
            resetBoundary: 'userLocalMidnight',
          };
          const b = quotaWindowBounds({ grant, nowMs, timeZone });
          const reset = b.resetsAtMs ?? Number.POSITIVE_INFINITY;
          expect(b.startMs).toBeLessThanOrEqual(nowMs);
          expect(nowMs).toBeLessThan(reset);
          const following = quotaWindowBounds({
            grant,
            nowMs: reset,
            timeZone,
          });
          expect(following.startMs).toBe(reset);
        }
      ),
      { seed: 20_260_919, numRuns: 400 }
    );
  });
});
