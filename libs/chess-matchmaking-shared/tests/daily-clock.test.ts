import { describe, expect, test } from 'bun:test';
import { resignGame } from '@libs/chess-matchmaking-shared/game-decisions';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import {
  clockLeftMs,
  clockRunning,
  multiplayerDeadlineMs,
  settleMultiplayerClock,
  spendMultiplayerClock,
  stopMultiplayerClock,
} from '@libs/chess-matchmaking-shared/multiplayer-clock';
import {
  dailyTimeControlId,
  daysPerMoveOf,
  isDailyTimeControl,
  startingMs,
  timeControlOf,
} from '@libs/chess-matchmaking-shared/time-control';

const DAY = 86_400_000;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E4_E5 =
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

/** A game started at time zero, as the scenario's position stands. */
function game(
  timeControl: string,
  position: { readonly fen: string; readonly revision: number }
): MultiplayerGame {
  return {
    id: 'game-1',
    white_id: 'white-user',
    black_id: 'black-user',
    fen: position.fen,
    pgn: '',
    revision: position.revision,
    turn: position.fen.includes(' w ') ? 'white-user' : 'black-user',
    outcome: 'ongoing',
    reason: null,
    time_control: timeControl,
    white_ms: startingMs(timeControl),
    black_ms: startingMs(timeControl),
    clock_at_ms: 0,
    paused_at_ms: null,
    draw_offer_by: null,
    rematch_offer_by: null,
    rematch_of: null,
    white_rating: null,
    black_rating: null,
    white_rating_diff: null,
    black_rating_diff: null,
  };
}

const NEW = { fen: START, revision: 0 };
const BEGUN = { fen: AFTER_E4_E5, revision: 2 };

describe('daily time controls', () => {
  test('1, 3 and 7 days per move are offered, and nothing else is daily', () => {
    expect(
      [1, 3, 7].map((days) => timeControlOf(dailyTimeControlId(days))?.speed)
    ).toEqual(['daily', 'daily', 'daily']);
    expect(timeControlOf(dailyTimeControlId(8))).toBeNull();
    expect(daysPerMoveOf('3d')).toBe(3);
    expect(startingMs('3d')).toBe(3 * DAY);
    expect(isDailyTimeControl('5+0')).toBe(false);
  });
});

describe("a daily game's multiplayer clock", () => {
  test('runs from the start, for the side to move only', () => {
    const fresh = game('3d', NEW);
    expect(clockRunning(fresh)).toBe(true);
    expect(clockLeftMs(fresh, 'white', DAY)).toBe(2 * DAY);
    expect(clockLeftMs(fresh, 'black', DAY)).toBe(3 * DAY);
    expect(clockRunning(game('5+0', NEW))).toBe(false);
  });

  test('a move hands the full days to the other person and saves up none', () => {
    const moved = spendMultiplayerClock(game('3d', BEGUN), DAY);
    expect([moved.white_ms, moved.black_ms, moved.clock_at_ms]).toEqual([
      3 * DAY,
      3 * DAY,
      DAY,
    ]);
  });

  test('a missed first move aborts after the full days, not after 30 seconds', () => {
    const fresh = game('1d', NEW);
    expect(multiplayerDeadlineMs(fresh)).toBe(DAY);
    expect(settleMultiplayerClock(fresh, DAY - 1)).toBe(fresh);
    expect(settleMultiplayerClock(fresh, DAY).outcome).toBe('aborted');
    const blackToMove = {
      ...game('3d', { fen: AFTER_E4, revision: 1 }),
      clock_at_ms: 2 * DAY,
      paused_at_ms: null,
    };
    expect(settleMultiplayerClock(blackToMove, 5 * DAY - 1)).toBe(blackToMove);
    expect(settleMultiplayerClock(blackToMove, 5 * DAY).reason).toBe(
      'first move missed'
    );
  });

  test('once both have moved, running out of time loses', () => {
    const settled = settleMultiplayerClock(game('1d', BEGUN), DAY);
    expect([settled.outcome, settled.reason, settled.white_ms]).toEqual([
      'black',
      'timeout',
      0,
    ]);
  });
});

describe('a game that ends while a clock is running', () => {
  // regression: chess-finished-game-clock-resets
  test('a result accepted during a shared pause retains time spent before the pause', () => {
    const paused = { ...game('5+0', BEGUN), paused_at_ms: 10_000 };
    const ended = {
      ...paused,
      outcome: 'black' as const,
      reason: 'account deletion',
    };
    const stopped = stopMultiplayerClock(paused, ended, DAY);
    expect(clockLeftMs(stopped, 'white', DAY)).toBe(290_000);
  });
  // regression: chess-finished-game-clock-resets
  test('keeps what the running clock had left when a person resigned', () => {
    const blitz = game('5+0', BEGUN);
    const resigned = stopMultiplayerClock(
      blitz,
      resignGame(blitz, 'white-user'),
      10_000
    );
    expect(clockLeftMs(resigned, 'white', 60_000)).toBe(290_000);
    const daily = game('3d', BEGUN);
    const dailyResigned = stopMultiplayerClock(
      daily,
      resignGame(daily, 'white-user'),
      DAY
    );
    expect(clockLeftMs(dailyResigned, 'white', 2 * DAY)).toBe(2 * DAY);
    expect(clockLeftMs(dailyResigned, 'black', 2 * DAY)).toBe(3 * DAY);
  });

  // regression: chess-finished-game-clock-resets
  test('leaves a daily clock at zero when its first move was missed', () => {
    const fresh = game('3d', NEW);
    const aborted = stopMultiplayerClock(
      fresh,
      settleMultiplayerClock(fresh, 3 * DAY),
      3 * DAY
    );
    expect([aborted.outcome, aborted.white_ms, aborted.black_ms]).toEqual([
      'aborted',
      0,
      3 * DAY,
    ]);
  });

  test('changes nothing for a clock that was not running or a move that ended the game', () => {
    const waiting = game('5+0', NEW);
    const aborted = settleMultiplayerClock(waiting, 30_000);
    expect(stopMultiplayerClock(waiting, aborted, 30_000)).toBe(aborted);
    const daily = game('3d', BEGUN);
    const mated = {
      ...spendMultiplayerClock(daily, DAY),
      revision: 3,
      outcome: 'white' as const,
    };
    expect(stopMultiplayerClock(daily, mated, DAY)).toBe(mated);
  });
});
