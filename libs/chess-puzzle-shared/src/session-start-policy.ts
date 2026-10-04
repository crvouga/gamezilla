/**
 * Pure decisions for the puzzle session lifecycle: when a client should
 * dispatch `StartChessPuzzlePlay` and when it should reclaim a stale host.
 * UI bindings own the effect scheduling and the
 * `lastStartedNonce` memory; this module owns the rules.
 */

import { CHESS_PUZZLE_PLAY_STATUS } from './chess-puzzle-play-attr';
import type { ChessPuzzlePlayStatus } from './chess-puzzle-play-attr';

export type PuzzleSessionStartDecision =
  /** Nothing to do this tick; keep the last-started nonce untouched. */
  | { readonly kind: 'skip' }
  /** Someone else already started this placement — remember the nonce, do not dispatch. */
  | { readonly kind: 'acknowledge' }
  /** Dispatch `StartChessPuzzlePlay` and remember the nonce. */
  | { readonly kind: 'start' };

export type PuzzleSessionStartInput = {
  readonly canDrive?: boolean;
  readonly identityReady: boolean;
  /** 0 means the screen has not armed a placement yet. */
  readonly startNonce: number;
  readonly lastStartedNonce: number;
  /** Bumps on every "Next" press. */
  readonly playGeneration: number;
  /** Screen bumps this after the puzzle-id swap lands. */
  readonly readyGeneration: number;
  readonly roomStatus: ChessPuzzlePlayStatus;
  readonly roomPuzzleId: string | null;
  readonly fen: string;
  readonly moves: string;
};

/**
 * A locally requested next puzzle cannot be placed until the room has
 * processed the preceding clear command. Consuming the attempt while the old
 * puzzle is still present loses the transition when that clear arrives.
 */
export function shouldDeferPuzzleAttemptPlacement(input: {
  readonly attemptSeed: number;
  readonly placedAttemptSeed: number;
  readonly roomPuzzleId: string | null;
}): boolean {
  return (
    input.attemptSeed !== input.placedAttemptSeed && input.roomPuzzleId !== null
  );
}

/**
 * Only Start when the screen arms a new placement (`startNonce` changed),
 * the parent has caught up (`playGeneration === readyGeneration`), the room
 * is idle with no puzzle loaded, and entity data is hydrated.
 */
export function decidePuzzleSessionStart(
  input: PuzzleSessionStartInput
): PuzzleSessionStartDecision {
  if (input.canDrive === false) return { kind: 'skip' };
  if (!input.identityReady) return { kind: 'skip' };
  if (input.startNonce === 0) return { kind: 'skip' };
  if (input.startNonce === input.lastStartedNonce) return { kind: 'skip' };
  if (input.playGeneration !== input.readyGeneration) return { kind: 'skip' };
  if (input.roomStatus !== CHESS_PUZZLE_PLAY_STATUS.idle) {
    return input.roomPuzzleId !== null
      ? { kind: 'acknowledge' }
      : { kind: 'skip' };
  }
  if (input.fen.length === 0 || input.moves.length === 0) {
    return { kind: 'skip' };
  }
  if (input.roomPuzzleId !== null) return { kind: 'acknowledge' };
  return { kind: 'start' };
}

export type PuzzleHostReclaimInput = {
  /** True only for the space host. */
  readonly canDrive?: boolean;
  readonly memberId: string;
  readonly roomStatus: ChessPuzzlePlayStatus;
  readonly hostIdentity: string | null;
  readonly roomSynced: boolean;
  /** True when the recorded host is still in the live presence roster. */
  readonly hostPresent: boolean;
};

/**
 * Reclaim host only when the recorded host is no longer in the live room
 * roster (stale / disconnected). Never steal from another connected player —
 * that caused an infinite reclaim ping-pong and event-log spam.
 */
export function shouldReclaimPuzzleHost(
  input: PuzzleHostReclaimInput
): boolean {
  if (input.canDrive === false) return false;
  if (input.memberId.length === 0) return false;
  if (input.roomStatus === CHESS_PUZZLE_PLAY_STATUS.idle) return false;
  if (input.hostIdentity === null || input.hostIdentity === input.memberId) {
    return false;
  }
  if (!input.roomSynced) return false;
  return !input.hostPresent;
}
