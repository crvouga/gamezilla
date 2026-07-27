import { createAttrNamespace } from '@pkgs/attribute';

import type { ChessPuzzleOrientation } from './chess-puzzle-fsm';

/**
 * FSM state stored at `chess.puzzle-play/status`. The session lifecycle is:
 *
 * - `idle`: no puzzle in play (default; also after `ClearChessPuzzlePlay`).
 * - `solving`: puzzle started, awaiting host's next move.
 * - `wrong`: host's last move did not match the solution; awaiting retry.
 * - `solved`: solution complete.
 * - `invalid`: puzzle FEN / moves payload could not be parsed or applied.
 */
export const CHESS_PUZZLE_PLAY_STATUS = {
  idle: 'idle',
  solving: 'solving',
  wrong: 'wrong',
  solved: 'solved',
  invalid: 'invalid',
} as const;

export type ChessPuzzlePlayStatus =
  (typeof CHESS_PUZZLE_PLAY_STATUS)[keyof typeof CHESS_PUZZLE_PLAY_STATUS];

const ALL_STATUSES: ReadonlySet<string> = new Set<string>(
  Object.values(CHESS_PUZZLE_PLAY_STATUS)
);

function readStatus(v: unknown): ChessPuzzlePlayStatus {
  if (typeof v === 'string' && ALL_STATUSES.has(v)) {
    return v as ChessPuzzlePlayStatus;
  }
  return CHESS_PUZZLE_PLAY_STATUS.idle;
}

function readNullableNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readNonNegativeInteger(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  return 0;
}

function readOrientation(v: unknown): ChessPuzzleOrientation {
  return v === 'black' ? 'black' : 'white';
}

const playNs = createAttrNamespace('chess', 'puzzle', 'play');

/** Room state slice for the active chess puzzle solving session. */
export const ChessPuzzlePlayAttr = {
  /** Lichess `PuzzleId` of the puzzle currently being solved (null when `idle`). */
  puzzleId: playNs.textOrNull('puzzle-id', readNullableNonEmptyString),
  /** Identity captured from the dispatcher of the first `StartChessPuzzlePlay`. */
  hostIdentity: playNs.textOrNull('host-identity', readNullableNonEmptyString),
  /** Initial FEN of the puzzle (before the opponent's first move). */
  fen: playNs.text('fen', readString),
  /** Space-separated UCI tokens of the full solution line (incl. opponent's first move). */
  moves: playNs.text('moves', readString),
  status: playNs.enum(
    'status',
    [
      CHESS_PUZZLE_PLAY_STATUS.idle,
      CHESS_PUZZLE_PLAY_STATUS.solving,
      CHESS_PUZZLE_PLAY_STATUS.wrong,
      CHESS_PUZZLE_PLAY_STATUS.solved,
      CHESS_PUZZLE_PLAY_STATUS.invalid,
    ] as const,
    readStatus
  ),
  /** Index of the next expected token in `moves`. */
  solveIdx: playNs.integer('solve-idx', readNonNegativeInteger),
  /**
   * Furthest `solveIdx` reached this attempt (high-water mark). Step-back
   * rewinds `solveIdx` without lowering this; step-forward may advance back
   * up to it — never past unattempted moves.
   */
  furthestSolveIdx: playNs.integer(
    'furthest-solve-idx',
    readNonNegativeInteger
  ),
  /** FEN currently rendered on the board (after applied moves). */
  displayFen: playNs.textOrNull('display-fen', readNullableNonEmptyString),
  /**
   * FEN that was rendered immediately before the last wrong move. Set
   * alongside `displayFen` when a wrong move is applied so `Retry` can
   * revert just that move (instead of resetting to the puzzle start).
   * Cleared on every other state transition.
   */
  previousDisplayFen: playNs.textOrNull(
    'previous-display-fen',
    readNullableNonEmptyString
  ),
  /** Side the host is sitting on; fixed for the session. */
  orientation: playNs.enum(
    'orientation',
    ['white', 'black'] as const,
    readOrientation
  ),
  /** Bumps on every wrong-move / reset so the chess board can force a remount when FEN string is unchanged. */
  layoutKey: playNs.integer('layout-key', readNonNegativeInteger),
  wrongFromSquare: playNs.textOrNull(
    'wrong-from-square',
    readNullableNonEmptyString
  ),
  wrongToSquare: playNs.textOrNull(
    'wrong-to-square',
    readNullableNonEmptyString
  ),
  expectedFromSquare: playNs.textOrNull(
    'expected-from-square',
    readNullableNonEmptyString
  ),
  expectedToSquare: playNs.textOrNull(
    'expected-to-square',
    readNullableNonEmptyString
  ),
  /**
   * Host promoted hint highlight → full solution arrow. Synced so every
   * client sees the same reveal (local-only flags do not cross the room).
   */
  solutionRevealed: playNs.integer('solution-revealed', (v) =>
    typeof v === 'number' && Number.isInteger(v) && v > 0 ? 1 : 0
  ),
} as const;

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export function isNullOrNonEmptyString(v: unknown): v is string | null {
  return v === null || isNonEmptyString(v);
}

export function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

export function isOrientation(v: unknown): v is ChessPuzzleOrientation {
  return v === 'white' || v === 'black';
}

export function isStatus(v: unknown): v is ChessPuzzlePlayStatus {
  return typeof v === 'string' && ALL_STATUSES.has(v);
}
