import { describe, expect, test } from 'bun:test';

import {
  formatPuzzleClock,
  isPuzzleClockRunning,
  puzzleElapsedMs,
} from '@libs/chess/public/puzzle-session';

describe('puzzle clock', () => {
  test('projects a running and frozen elapsed duration', () => {
    expect(
      puzzleElapsedMs({ startedAtMs: null, endedAtMs: null, nowMs: 5 })
    ).toBeNull();
    expect(
      puzzleElapsedMs({ startedAtMs: 1_000, endedAtMs: null, nowMs: 4_250 })
    ).toBe(3_250);
    expect(
      puzzleElapsedMs({ startedAtMs: 1_000, endedAtMs: 3_000, nowMs: 9_000 })
    ).toBe(2_000);
    expect(
      puzzleElapsedMs({ startedAtMs: 4_000, endedAtMs: null, nowMs: 2_000 })
    ).toBe(0);
  });

  test('formats minutes and seconds without resetting after an hour', () => {
    expect(formatPuzzleClock(0)).toBe('0:00');
    expect(formatPuzzleClock(90_000)).toBe('1:30');
    expect(formatPuzzleClock(3_661_000)).toBe('61:01');
  });

  test('runs only while solving or waiting after a wrong move', () => {
    expect(isPuzzleClockRunning('solving')).toBe(true);
    expect(isPuzzleClockRunning('wrong')).toBe(true);
    expect(isPuzzleClockRunning('skipped')).toBe(false);
    expect(isPuzzleClockRunning('solved')).toBe(false);
    expect(isPuzzleClockRunning('loading')).toBe(false);
    expect(isPuzzleClockRunning('invalid')).toBe(false);
    expect(isPuzzleClockRunning('idle')).toBe(false);
  });
});
