import { describe, expect, test } from 'bun:test';
import {
  dailyClockParts,
  dailyClockStepMs,
} from '@libs/game-matchmaking-client/multiplayer-format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("a daily game's clock in the units people plan by", () => {
  test('whole days read as days alone', () => {
    expect(dailyClockParts(3 * DAY)).toEqual({
      unit: 'days',
      days: 3,
      hours: 0,
    });
    expect(dailyClockParts(2 * DAY)).toEqual({
      unit: 'days',
      days: 2,
      hours: 0,
    });
  });

  test('a day or more reads as days and hours, rounded up', () => {
    expect(dailyClockParts(2 * DAY + 5 * HOUR)).toEqual({
      unit: 'days',
      days: 2,
      hours: 5,
    });
    expect(dailyClockParts(2 * DAY + 4 * HOUR + 1)).toEqual({
      unit: 'days',
      days: 2,
      hours: 5,
    });
    expect(dailyClockParts(DAY)).toEqual({ unit: 'days', days: 1, hours: 0 });
  });

  test('under a day reads as hours and minutes, rounded up', () => {
    expect(dailyClockParts(5 * HOUR + 12 * MINUTE)).toEqual({
      unit: 'hours',
      hours: 5,
      minutes: 12,
    });
    expect(dailyClockParts(DAY - MINUTE)).toEqual({
      unit: 'hours',
      hours: 23,
      minutes: 59,
    });
    expect(dailyClockParts(DAY - 1)).toEqual({
      unit: 'days',
      days: 1,
      hours: 0,
    });
    expect(dailyClockParts(HOUR)).toEqual({
      unit: 'hours',
      hours: 1,
      minutes: 0,
    });
  });

  test('under an hour hands over to the ordinary clock, never below zero', () => {
    expect(dailyClockParts(HOUR - MINUTE)).toEqual({
      unit: 'seconds',
      ms: HOUR - MINUTE,
    });
    expect(dailyClockParts(-5)).toEqual({ unit: 'seconds', ms: 0 });
  });

  test('the clock next reads differently when its smallest unit turns over', () => {
    expect(dailyClockStepMs(3 * DAY)).toBe(HOUR);
    expect(dailyClockStepMs(2 * DAY + 30 * MINUTE)).toBe(30 * MINUTE);
    expect(dailyClockStepMs(5 * HOUR + 30_000)).toBe(30_000);
    expect(dailyClockStepMs(90_500)).toBe(500);
  });
});
