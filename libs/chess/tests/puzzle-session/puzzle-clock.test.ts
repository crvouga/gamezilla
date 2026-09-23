import { describe, expect, test } from 'bun:test';

import {
  formatPuzzleClock,
  isPuzzleClockRunning,
  nextPuzzleClockAnchor,
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
    expect(isPuzzleClockRunning('solved')).toBe(false);
    expect(isPuzzleClockRunning('invalid')).toBe(false);
    expect(isPuzzleClockRunning('loading')).toBe(false);
    expect(isPuzzleClockRunning('idle')).toBe(false);
  });

  test('starts, freezes, and restarts with the attempt', () => {
    const started = nextPuzzleClockAnchor({
      previous: null,
      puzzleId: 'p1',
      layoutKey: 1,
      status: 'solving',
      nowMs: 1_000,
    });
    expect(started?.startedAtMs).toBe(1_000);
    expect(started?.endedAtMs).toBeNull();

    const wrong = nextPuzzleClockAnchor({
      previous: started,
      puzzleId: 'p1',
      layoutKey: 1,
      status: 'wrong',
      nowMs: 2_000,
    });
    expect(wrong?.startedAtMs).toBe(1_000);
    expect(wrong?.endedAtMs).toBeNull();

    const retried = nextPuzzleClockAnchor({
      previous: wrong,
      puzzleId: 'p1',
      layoutKey: 2,
      status: 'solving',
      nowMs: 2_500,
    });
    expect(retried?.startedAtMs).toBe(1_000);

    const solved = nextPuzzleClockAnchor({
      previous: retried,
      puzzleId: 'p1',
      layoutKey: 2,
      status: 'solved',
      nowMs: 4_000,
    });
    expect(solved?.endedAtMs).toBe(4_000);
    expect(
      puzzleElapsedMs({
        startedAtMs: solved?.startedAtMs ?? null,
        endedAtMs: solved?.endedAtMs ?? null,
        nowMs: 9_000,
      })
    ).toBe(3_000);

    const restarted = nextPuzzleClockAnchor({
      previous: solved,
      puzzleId: 'p1',
      layoutKey: 3,
      status: 'solving',
      nowMs: 5_000,
    });
    expect(restarted?.startedAtMs).toBe(5_000);

    expect(
      nextPuzzleClockAnchor({
        previous: null,
        puzzleId: 'p1',
        layoutKey: 1,
        status: 'loading',
        nowMs: 1,
      })
    ).toBeNull();
  });
});
