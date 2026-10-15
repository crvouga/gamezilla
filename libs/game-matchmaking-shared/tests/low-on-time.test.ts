import { describe, expect, test } from 'bun:test';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import {
  clockLowOnTime,
  lowOnTimeAtMs,
  lowOnTimeLimitMs,
} from '@libs/game-matchmaking-shared/multiplayer-clock';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** White to move with `leftMs` on a clock that started at time zero. */
function whiteToMove(
  timeControl: string,
  leftMs: number,
  patch: Partial<MultiplayerGame> = {}
): MultiplayerGame {
  return {
    id: 'game-1',
    white_id: 'white-user',
    black_id: 'black-user',
    fen: START,
    pgn: '',
    revision: 2,
    turn: 'white-user',
    outcome: 'ongoing',
    reason: null,
    time_control: timeControl,
    white_ms: leftMs,
    black_ms: leftMs,
    clock_at_ms: 0,
    paused_at_ms: null,
    draw_offer_by: null,
    rematch_offer_by: null,
    rematch_of: null,
    white_rating: null,
    black_rating: null,
    white_rating_diff: null,
    black_rating_diff: null,
    ...patch,
  };
}

describe('the time left at which a multiplayer clock is low on time', () => {
  test.each([
    ['1+0', 10_000],
    ['2+1', 10_000],
    ['3+0', 20_000],
    ['5+3', 20_000],
    ['10+0', 30_000],
    ['15+10', 30_000],
    ['30+0', 60_000],
    ['30+20', 60_000],
    ['1d', 6 * HOUR_MS],
    ['3d', DAY_MS],
    ['7d', DAY_MS],
  ])('%s is low on time with %d ms or less', (timeControl, limit) => {
    expect(lowOnTimeLimitMs(timeControl)).toBe(limit);
  });

  test('a time control nobody offers has no such time', () => {
    expect(lowOnTimeLimitMs('4+4')).toBe(0);
    expect(lowOnTimeLimitMs(null)).toBe(0);
  });
});

describe('a running multiplayer clock at its limit', () => {
  test.each([
    ['1+0', 10_000],
    ['3+0', 20_000],
    ['10+0', 30_000],
    ['30+0', 60_000],
    ['1d', 6 * HOUR_MS],
    ['3d', DAY_MS],
    ['7d', DAY_MS],
  ])(
    '%s: low at the limit, not one millisecond above it',
    (timeControl, limit) => {
      const game = whiteToMove(timeControl, limit + 5_000);
      expect(clockLowOnTime(game, 'white', 4_999)).toBe(false);
      expect(clockLowOnTime(game, 'white', 5_000)).toBe(true);
      expect(clockLowOnTime(game, 'white', limit + 5_000)).toBe(true);
      expect(lowOnTimeAtMs(game)).toBe(5_000);
    }
  );

  test('only the side to move is ever low on time', () => {
    const game = whiteToMove('1+0', 5_000);
    expect(clockLowOnTime(game, 'white', 0)).toBe(true);
    expect(clockLowOnTime(game, 'black', 0)).toBe(false);
  });

  test('a clock that has not started is not low on time', () => {
    const waiting = whiteToMove('1+0', 5_000, { revision: 1 });
    expect(clockLowOnTime(waiting, 'white', 0)).toBe(false);
    expect(lowOnTimeAtMs(waiting)).toBeNull();
  });

  test('a daily clock runs, and can be low on time, from the first move', () => {
    const first = whiteToMove('3d', 3 * DAY_MS, { revision: 0 });
    expect(clockLowOnTime(first, 'white', 2 * DAY_MS - 1)).toBe(false);
    expect(clockLowOnTime(first, 'white', 2 * DAY_MS)).toBe(true);
    expect(lowOnTimeAtMs(first)).toBe(2 * DAY_MS);
  });

  test.each(['white', 'black', 'draw', 'aborted'] as const)(
    'a game that ended as %s has no clock low on time',
    (outcome) => {
      const over = whiteToMove('1+0', 5_000, { outcome, turn: '' });
      expect(clockLowOnTime(over, 'white', 0)).toBe(false);
      expect(lowOnTimeAtMs(over)).toBeNull();
    }
  );
});
