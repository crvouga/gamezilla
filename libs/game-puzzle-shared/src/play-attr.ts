import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import type { GameSide } from '@pkgs/turn-game-shared/game-rules';
import { parseRecommendations } from './recommendations';

/**
 * FSM state stored at `chess.puzzle-play/status`. The session lifecycle is:
 *
 * - `idle`: no puzzle in play (default; also after `ClearPuzzlePlay`).
 * - `solving`: puzzle started, awaiting host's next move.
 * - `wrong`: host's last move did not match the solution; the piece stays
 *   on its wrong square (`displayPosition` is still the position before it);
 *   awaiting retry.
 * - `solved`: solution complete.
 * - `revealed`: the host asked to see the solution; the rest of the line was
 *   played out and the attempt is in review (terminal, step back / forward).
 * - `skipped`: host moved on without solving; terminal until cleared.
 * - `invalid`: puzzle's position / line could not be set up.
 */
export const PUZZLE_PLAY_STATUS = {
  idle: 'idle',
  solving: 'solving',
  wrong: 'wrong',
  solved: 'solved',
  revealed: 'revealed',
  skipped: 'skipped',
  invalid: 'invalid',
} as const;

export type PuzzlePlayStatus =
  (typeof PUZZLE_PLAY_STATUS)[keyof typeof PUZZLE_PLAY_STATUS];

const ALL_STATUSES: ReadonlySet<string> = new Set<string>(
  Object.values(PUZZLE_PLAY_STATUS)
);

function readStatus(v: unknown): PuzzlePlayStatus {
  if (typeof v === 'string' && ALL_STATUSES.has(v)) {
    return v as PuzzlePlayStatus;
  }
  return PUZZLE_PLAY_STATUS.idle;
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

function readSolverSide(v: unknown): GameSide {
  return v === 'black' ? 'black' : 'white';
}

function readNullableNonNegativeInteger(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  return null;
}

const playNs = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'puzzle', 'play');

/** Room state slice for the space's puzzle solving session, whatever its game. */
export const PuzzlePlayAttr = {
  /** Catalogue id of the puzzle currently being solved (null when `idle`). */
  puzzleId: playNs.textOrNull('puzzle-id', readNullableNonEmptyString),
  /** Identity captured from the dispatcher of the first `StartPuzzlePlay`. */
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
  /** The puzzle's position, before the opponent's setup move. */
  position: playNs.text('fen', readString),
  /**
   * The actions of the line being followed, joined by spaces (incl. the
   * opponent's setup move). Starts as the stored solution; an accepted
   * alternative win or transposition rewrites it to what was played.
   */
  line: playNs.text('moves', readString),
  status: playNs.enum(
    'status',
    [
      PUZZLE_PLAY_STATUS.idle,
      PUZZLE_PLAY_STATUS.solving,
      PUZZLE_PLAY_STATUS.wrong,
      PUZZLE_PLAY_STATUS.solved,
      PUZZLE_PLAY_STATUS.revealed,
      PUZZLE_PLAY_STATUS.skipped,
      PUZZLE_PLAY_STATUS.invalid,
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
  /** The position currently on the board (after applied moves). */
  displayPosition: playNs.textOrNull('display-fen', readNullableNonEmptyString),
  /** The side the host solves as (`PlayedPosition.turn` after setup); fixed for the session. */
  solverSide: playNs.enum(
    'orientation',
    ['white', 'black'] as const,
    readSolverSide
  ),
  /** Bumps on every wrong-move / reset so the board can force a remount when the position is unchanged. */
  layoutKey: playNs.integer('layout-key', readNonNegativeInteger),
  /** The wrong action the host played, shown until a retry. */
  wrongAction: playNs.textOrNull('wrong-uci', readNullableNonEmptyString),
  /** The cell the wrong action ended on (`PuzzleMarks.to`). */
  wrongMark: playNs.textOrNull('wrong-to-square', readNullableNonEmptyString),
  /** The hint: the cells the expected action names (`PuzzleMarks`). */
  hintFrom: playNs.textOrNull(
    'expected-from-square',
    readNullableNonEmptyString
  ),
  hintTo: playNs.textOrNull('expected-to-square', readNullableNonEmptyString),
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

export function isSide(v: unknown): v is GameSide {
  return v === 'white' || v === 'black';
}

export function isStatus(v: unknown): v is PuzzlePlayStatus {
  return typeof v === 'string' && ALL_STATUSES.has(v);
}
