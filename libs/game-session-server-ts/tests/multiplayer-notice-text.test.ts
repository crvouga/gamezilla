import { describe, expect, test } from 'bun:test';
import {
  timeLeftText,
  turnReminderBody,
} from '@libs/game-session-server-ts/multiplayer-notice-text';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

describe('the time left a turn reminder gives', () => {
  test.each([
    [DAY_MS, '1 day'],
    [DAY_MS - 5, '1 day'],
    [6 * HOUR_MS, '6 hours'],
    [6 * HOUR_MS - 5, '6 hours'],
    [DAY_MS + 2 * HOUR_MS, '1 day 2 hours'],
    [2 * DAY_MS, '2 days'],
    [HOUR_MS, '1 hour'],
    [5 * HOUR_MS + 20 * MINUTE_MS, '5 hours 20 minutes'],
    [40 * MINUTE_MS, '40 minutes'],
    [MINUTE_MS, '1 minute'],
    [1, '1 minute'],
    [0, '0 minutes'],
  ])('%d ms left reads "%s"', (ms, text) => {
    expect(timeLeftText(ms)).toBe(text);
  });

  test('it never says less than is left', () => {
    expect(timeLeftText(23 * HOUR_MS + 59 * MINUTE_MS + 1)).toBe('1 day');
  });

  test('the reminder says how long the person has to move', () => {
    expect(turnReminderBody('1 day')).toBe(
      "It's your turn. You have 1 day left to move."
    );
  });
});
