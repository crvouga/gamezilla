import { describe, expect, test } from 'bun:test';
import { resignGame } from '@libs/game-matchmaking-shared/game-decisions';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import {
  clockLeftMs,
  settleMultiplayerClock,
  spendMultiplayerClock,
  stopMultiplayerClock,
} from '@libs/game-matchmaking-shared/multiplayer-clock';
import { startingMs } from '@libs/game-matchmaking-shared/time-control';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';

/**
 * No game's rules: a missed first move aborts without asking them, and no
 * case here reaches a flag fall, so stopping a clock needs no game at all.
 */
const NO_GAMES = createTurnGames([]);

const DAY = 86_400_000;

/** A game started at time zero; positions are opaque to the clock. */
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
    turn: position.revision % 2 === 0 ? 'white-user' : 'black-user',
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

const NEW = { fen: 'opaque start', revision: 0 };
const BEGUN = { fen: 'opaque after two moves', revision: 2 };

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
      settleMultiplayerClock(fresh, 3 * DAY, NO_GAMES),
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
    const aborted = settleMultiplayerClock(waiting, 30_000, NO_GAMES);
    expect(stopMultiplayerClock(waiting, aborted, 30_000)).toBe(aborted);
    const daily = game('3d', BEGUN);
    const won = {
      ...spendMultiplayerClock(daily, DAY),
      revision: 3,
      outcome: 'white' as const,
    };
    expect(stopMultiplayerClock(daily, won, DAY)).toBe(won);
  });
});
