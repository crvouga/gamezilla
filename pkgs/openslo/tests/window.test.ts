import { describe, expect, test } from 'bun:test';
import type { TimeWindow } from '@pkgs/openslo/model';
import {
  parseDuration,
  parseStartTime,
  timeWindowBounds,
} from '@pkgs/openslo/window';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('durations', () => {
  test.each([
    ['30s', 30_000],
    ['5m', 300_000],
    ['1h', HOUR],
    ['28d', 28 * DAY],
    ['2w', 14 * DAY],
  ] as const)('%s', (text, ms) => {
    expect(parseDuration(text)).toBe(ms);
  });

  test.each(['0d', '1M', '1.5h', '-1d', '28', 'd', '', ' 1d', '1 d'])(
    '%p is not a duration',
    (text) => {
      expect(parseDuration(text)).toBeNull();
    }
  );
});

describe('calendar start times', () => {
  test('are UTC', () => {
    expect(parseStartTime('2026-01-05 00:00:00')).toBe(Date.UTC(2026, 0, 5));
    expect(parseStartTime('2026-01-05T06:30:15Z')).toBe(
      Date.UTC(2026, 0, 5, 6, 30, 15)
    );
  });

  test.each([
    '2026-02-30 00:00:00',
    '2026-01-05',
    '2026-01-05 24:00:00',
    'monday',
  ])('%p is not a start time', (text) => {
    expect(parseStartTime(text)).toBeNull();
  });
});

describe('window bounds', () => {
  const now = Date.UTC(2026, 8, 28, 12);

  test('a rolling window ends now and reaches back one duration', () => {
    const rolling: TimeWindow = {
      duration: '1d',
      isRolling: true,
      calendar: null,
    };
    expect(timeWindowBounds(rolling, now)).toEqual({
      startMs: now - DAY,
      endMs: now,
    });
  });

  const weekly: TimeWindow = {
    duration: '1w',
    isRolling: false,
    calendar: { startTime: '2026-01-05 00:00:00', timeZone: 'UTC' },
  };

  test('a calendar window starts at the period holding now', () => {
    // 2026-09-28 is a Monday, 38 weeks after 2026-01-05.
    expect(timeWindowBounds(weekly, now)).toEqual({
      startMs: Date.UTC(2026, 8, 28),
      endMs: now,
    });
    expect(timeWindowBounds(weekly, now + 5 * DAY)).toEqual({
      startMs: Date.UTC(2026, 8, 28),
      endMs: now + 5 * DAY,
    });
  });

  test('the first instant of a period starts a new window', () => {
    const monday = Date.UTC(2026, 8, 28);
    expect(timeWindowBounds(weekly, monday)).toEqual({
      startMs: monday,
      endMs: monday,
    });
    expect(timeWindowBounds(weekly, monday - 1).startMs).toBe(monday - 7 * DAY);
  });

  test('periods tile back before the start time too', () => {
    const before = Date.UTC(2026, 0, 1);
    expect(timeWindowBounds(weekly, before).startMs).toBe(
      Date.UTC(2025, 11, 29)
    );
  });

  test('a time zone other than UTC is refused', () => {
    expect(() =>
      timeWindowBounds(
        {
          ...weekly,
          calendar: {
            startTime: '2026-01-05 00:00:00',
            timeZone: 'Asia/Tokyo',
          },
        },
        now
      )
    ).toThrow('not supported');
  });
});
