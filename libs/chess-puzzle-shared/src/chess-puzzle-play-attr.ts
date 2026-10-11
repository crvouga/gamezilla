import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import type { ChessPuzzleOrientation } from './chess-puzzle-fsm';
import { parseRecommendations } from './recommendations';

/**
 * FSM state stored at `chess.puzzle-play/status`. The session lifecycle is:
 *
 * - `idle`: no puzzle in play (default; also after `ClearChessPuzzlePlay`).
 * - `solving`: puzzle started, awaiting host's next move.
 * - `wrong`: host's last move did not match the solution; the piece stays
 *   on its wrong square (`displayFen` is still the position before it);
 *   awaiting retry.
 * - `solved`: solution complete.
 * - `revealed`: the host asked to see the solution; the rest of the line was
 *   played out and the attempt is in review (terminal, step back / forward).
 * - `skipped`: host moved on without solving; terminal until cleared.
 * - `invalid`: puzzle FEN / moves payload could not be parsed or applied.
 */
export const CHESS_PUZZLE_PLAY_STATUS = {
  idle: 'idle',
  solving: 'solving',
  wrong: 'wrong',
  solved: 'solved',
  revealed: 'revealed',
  skipped: 'skipped',
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

function readNullableNonNegativeInteger(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  return null;
}

const playNs = createAttrNamespace('chess', 'puzzle', 'play');

/** Room state slice for the active chess puzzle solving session. */
export const ChessPuzzlePlayAttr = {
  /** Lichess `PuzzleId` of the puzzle currently being solved (null when `idle`). */
  puzzleId: playNs.textOrNull('puzzle-id', readNullableNonEmptyString),
  /** Identity captured from the dispatcher of the first `StartChessPuzzlePlay`. */
  hostIdentity: playNs.textOrNull('host-identity', readNullableNonEmptyString),
  /**
   * Server commit time (ms) of the command that started this attempt. The
   * puzzle clock renders `now - startedAtMs`; `null` before start / after clear.
   */
  startedAtMs: playNs.integerOrNull(
    'started-at-ms',
    readNullableNonNegativeInteger
  ),
  /**
   * Server commit time (ms) of the terminal event (`solved` / `revealed` /
   * `skipped`).
   * `null` while the attempt is still running.
   */
  endedAtMs: playNs.integerOrNull(
    'ended-at-ms',
    readNullableNonNegativeInteger
  ),
  /** Initial FEN of the puzzle (before the opponent's first move). */
  fen: playNs.text('fen', readString),
  /**
   * Space-separated UCI tokens of the line being followed (incl. the
   * opponent's first move). Starts as the stored solution; an accepted
   * alternative mate or transposition rewrites it to what was played.
   */
  moves: playNs.text('moves', readString),
  status: playNs.enum(
    'status',
    [
      CHESS_PUZZLE_PLAY_STATUS.idle,
      CHESS_PUZZLE_PLAY_STATUS.solving,
      CHESS_PUZZLE_PLAY_STATUS.wrong,
      CHESS_PUZZLE_PLAY_STATUS.solved,
      CHESS_PUZZLE_PLAY_STATUS.revealed,
      CHESS_PUZZLE_PLAY_STATUS.skipped,
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
  /** Side the host is sitting on; fixed for the session. */
  orientation: playNs.enum(
    'orientation',
    ['white', 'black'] as const,
    readOrientation
  ),
  /** Bumps on every wrong-move / reset so the chess board can force a remount when FEN string is unchanged. */
  layoutKey: playNs.integer('layout-key', readNonNegativeInteger),
  wrongUci: playNs.textOrNull('wrong-uci', readNullableNonEmptyString),
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
  /**
   * Spectator move suggestions keyed by member id, synced so every client
   * (host included) sees the same arrows. Cleared whenever the position the
   * suggestions were made for stops being the live one.
   */
  recommendations: playNs.json('recommendations', parseRecommendations),
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

export function isNullOrNonNegativeInteger(v: unknown): v is number | null {
  return v === null || isNonNegativeInteger(v);
}

export function isOrientation(v: unknown): v is ChessPuzzleOrientation {
  return v === 'white' || v === 'black';
}

export function isStatus(v: unknown): v is ChessPuzzlePlayStatus {
  return typeof v === 'string' && ALL_STATUSES.has(v);
}
