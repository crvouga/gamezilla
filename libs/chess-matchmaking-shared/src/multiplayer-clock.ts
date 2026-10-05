import type { MultiplayerGame } from './game-state';
import {
  bothHaveMoved,
  endMultiplayerGame,
  multiplayerBoard,
} from './game-state';
import { canCheckmate } from './mating-material';
import { incrementMs } from './time-control';

/** White has this long from the start, Black this long from White's first move. */
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

/** Whether the side to move is spending time right now. */
export function clockRunning(game: ClockFields): boolean {
  return game.outcome === 'ongoing' && timed(game) && bothHaveMoved(game);
}

/** Time left on one side's multiplayer clock at `nowMs`, never below zero. */
export function clockLeftMs(
  game: ClockFields,
  side: MultiplayerSide,
  nowMs: number
): number {
  const stored = (side === 'white' ? game.white_ms : game.black_ms) ?? 0;
  if (!clockRunning(game) || sideToMove(game) !== side) return stored;
  return Math.max(0, stored - (nowMs - (game.clock_at_ms ?? nowMs)));
}

/**
 * When the unfinished game ends by itself unless someone moves: a missed
 * first move, or the side to move running out of time.
 */
export function multiplayerDeadlineMs(game: ClockFields): number | null {
  if (game.outcome !== 'ongoing' || !timed(game)) return null;
  const startedAt = game.clock_at_ms ?? 0;
  if (!bothHaveMoved(game)) return startedAt + FIRST_MOVE_MS;
  const side = sideToMove(game);
  return startedAt + ((side === 'white' ? game.white_ms : game.black_ms) ?? 0);
}

/**
 * The game as it stands at `nowMs`: a missed first move aborts it, and a
 * clock at zero loses for the side to move, or draws when the other side
 * cannot checkmate (FIDE 6.9). Pure, so every reader decides alike.
 */
export function settleMultiplayerClock(
  game: MultiplayerGame,
  nowMs: number
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
  const board = multiplayerBoard(game);
  if (!canCheckmate(board, flagged === 'white' ? 'b' : 'w'))
    return endMultiplayerGame(out, 'draw', 'timeout vs insufficient material');
  return endMultiplayerGame(
    out,
    flagged === 'white' ? 'black' : 'white',
    'timeout'
  );
}

/** The mover's clock after a legal move at `nowMs`, with the increment once both have moved. */
export function spendMultiplayerClock(
  game: MultiplayerGame,
  nowMs: number
): MultiplayerGame {
  if (!timed(game)) return game;
  if (!bothHaveMoved(game)) return { ...game, clock_at_ms: nowMs };
  const side = sideToMove(game);
  const left = clockLeftMs(game, side, nowMs) + incrementMs(game.time_control);
  return {
    ...game,
    ...(side === 'white' ? { white_ms: left } : { black_ms: left }),
    clock_at_ms: nowMs,
  };
}
