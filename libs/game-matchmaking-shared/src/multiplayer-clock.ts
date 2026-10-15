import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { MultiplayerGame } from './game-state';
import { bothHaveMoved, endMultiplayerGame } from './game-state';
import type { ClockSpeed } from './time-control';
import {
  incrementMs,
  isDailyTimeControl,
  startingMs,
  timeControlOf,
} from './time-control';

/**
 * White has this long from the start, Black this long from White's first
 * move. A daily game gives each the time control's days instead.
 */
export const FIRST_MOVE_MS = 30_000;

export type MultiplayerSide = 'white' | 'black';

type ClockFields = Pick<
  MultiplayerGame,
  | 'fen'
  | 'outcome'
  | 'revision'
  | 'time_control'
  | 'white_ms'
  | 'black_ms'
  | 'clock_at_ms'
  | 'paused_at_ms'
>;

export function sideToMove(
  game: Pick<MultiplayerGame, 'fen'>
): MultiplayerSide {
  return game.fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function timed(game: ClockFields): boolean {
  return (
    game.time_control !== null &&
    game.clock_at_ms !== null &&
    game.white_ms !== null &&
    game.black_ms !== null
  );
}

function daily(game: Pick<MultiplayerGame, 'time_control'>): boolean {
  return isDailyTimeControl(game.time_control);
}

/** How long the side to move has for a first move. */
function firstMoveMs(game: Pick<MultiplayerGame, 'time_control'>): number {
  return daily(game) ? startingMs(game.time_control) : FIRST_MOVE_MS;
}

/**
 * Whether the side to move is spending time right now. A daily game's clock
 * runs from the start; any other waits until both people have moved.
 */
export function clockRunning(game: ClockFields): boolean {
  return (
    game.outcome === 'ongoing' &&
    game.paused_at_ms === null &&
    timed(game) &&
    (bothHaveMoved(game) || daily(game))
  );
}

/** Time left on one side's multiplayer clock at `nowMs`, never below zero. */
export function clockLeftMs(
  game: ClockFields,
  side: MultiplayerSide,
  nowMs: number
): number {
  const stored = (side === 'white' ? game.white_ms : game.black_ms) ?? 0;
  if (
    game.outcome !== 'ongoing' ||
    !timed(game) ||
    (!bothHaveMoved(game) && !daily(game)) ||
    sideToMove(game) !== side
  )
    return stored;
  const at = game.paused_at_ms ?? nowMs;
  return Math.max(0, stored - (at - (game.clock_at_ms ?? at)));
}

/**
 * When the unfinished game ends by itself unless someone moves: a missed
 * first move, or the side to move running out of time.
 */
export function multiplayerDeadlineMs(game: ClockFields): number | null {
  if (game.outcome !== 'ongoing' || game.paused_at_ms !== null || !timed(game))
    return null;
  const startedAt = game.clock_at_ms ?? 0;
  if (!bothHaveMoved(game)) return startedAt + firstMoveMs(game);
  const side = sideToMove(game);
  return startedAt + ((side === 'white' ? game.white_ms : game.black_ms) ?? 0);
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const LOW_ON_TIME_MS: Readonly<Record<Exclude<ClockSpeed, 'daily'>, number>> = {
  bullet: 10_000,
  blitz: 20_000,
  rapid: 30_000,
  classical: 60_000,
};

/**
 * The time left at or below which a running clock is low on time: seconds by
 * speed, and in a daily game six hours at one day per move, else one day.
 * Zero for a time control nobody offers.
 */
export function lowOnTimeLimitMs(
  timeControl: string | null | undefined
): number {
  const control = timeControlOf(timeControl);
  if (control === null) return 0;
  const speed = control.speed.split(':').at(-1)! as ClockSpeed;
  if (speed !== 'daily') return LOW_ON_TIME_MS[speed];
  return control.daysPerMove === 1 ? 6 * HOUR_MS : DAY_MS;
}

/**
 * Whether one side's clock is low on time at `nowMs`: it is running, that
 * side is to move, and no more than the time control's limit is left.
 */
export function clockLowOnTime(
  game: ClockFields,
  side: MultiplayerSide,
  nowMs: number
): boolean {
  return (
    clockRunning(game) &&
    sideToMove(game) === side &&
    clockLeftMs(game, side, nowMs) <= lowOnTimeLimitMs(game.time_control)
  );
}

/**
 * When the running clock becomes low on time unless its side moves first;
 * null while no clock is running.
 */
export function lowOnTimeAtMs(game: ClockFields): number | null {
  const deadline = clockRunning(game) ? multiplayerDeadlineMs(game) : null;
  return deadline === null
    ? null
    : deadline - lowOnTimeLimitMs(game.time_control);
}

/**
 * The game as it stands at `nowMs`: a missed first move aborts it, and a
 * clock at zero loses for the side to move, or draws when the other side
 * cannot win under the registered rules. Pure, so every reader decides alike.
 */
export function settleMultiplayerClock(
  game: MultiplayerGame,
  nowMs: number,
  rules: TurnGames
): MultiplayerGame {
  const deadline = multiplayerDeadlineMs(game);
  if (deadline === null || nowMs < deadline) return game;
  if (!bothHaveMoved(game))
    return endMultiplayerGame(game, 'aborted', 'first move missed');
  const flagged = sideToMove(game);
  const out = {
    ...game,
    ...(flagged === 'white' ? { white_ms: 0 } : { black_ms: 0 }),
  };
  if (
    !rules
      .forPosition(game.fen)
      .canWin(game.fen, flagged === 'white' ? 'black' : 'white')
  )
    return endMultiplayerGame(out, 'draw', 'timeout vs insufficient material');
  return endMultiplayerGame(
    out,
    flagged === 'white' ? 'black' : 'white',
    'timeout'
  );
}

/**
 * A game that ended while a clock was running keeps what that clock had
 * left at `nowMs`: resigning, aborting or agreeing a draw stops the clock
 * where it stood, and a missed first move in a daily game leaves it at
 * zero. A move that ended the game has already settled its own clock.
 */
export function stopMultiplayerClock(
  before: MultiplayerGame,
  after: MultiplayerGame,
  nowMs: number
): MultiplayerGame {
  if (
    after.outcome === 'ongoing' ||
    before.outcome !== 'ongoing' ||
    !timed(before) ||
    (!bothHaveMoved(before) && !daily(before))
  )
    return after;
  if (after.revision !== before.revision) return after;
  const side = sideToMove(before);
  const stored = (side === 'white' ? after.white_ms : after.black_ms) ?? 0;
  const left = Math.min(stored, clockLeftMs(before, side, nowMs));
  return {
    ...after,
    ...(side === 'white' ? { white_ms: left } : { black_ms: left }),
  };
}

/**
 * The clocks after a legal move at `nowMs`: the mover's time spent, with the
 * increment once both have moved. A daily game instead hands the full days
 * to the other person and saves up none of the mover's.
 */
export function spendMultiplayerClock(
  game: MultiplayerGame,
  nowMs: number
): MultiplayerGame {
  if (!timed(game)) return game;
  if (daily(game)) {
    const full = startingMs(game.time_control);
    return { ...game, white_ms: full, black_ms: full, clock_at_ms: nowMs };
  }
  if (!bothHaveMoved(game)) return { ...game, clock_at_ms: nowMs };
  const side = sideToMove(game);
  const left = clockLeftMs(game, side, nowMs) + incrementMs(game.time_control);
  return {
    ...game,
    ...(side === 'white' ? { white_ms: left } : { black_ms: left }),
    clock_at_ms: nowMs,
  };
}
