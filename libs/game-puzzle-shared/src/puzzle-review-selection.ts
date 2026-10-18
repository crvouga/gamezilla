/**
 * The puzzle a space is reviewing from its stats, and the review's cursor:
 * shared room state, so everyone in the space sees the same review. Its
 * room keys (`chess.main-menu.selected-review-*`) and messages
 * (`chess-cmd` / `chess-evt`) keep their established names; a game's own
 * room may add messages of its own to the same namespaces.
 */

import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared/durable-names';
import type { GameCommandContext } from '@libs/spaces-shared/game';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';

function readSelectedReviewPuzzleId(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readNonNegativeInteger(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  return 0;
}

function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

const reviewNs = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'main-menu');

/** Room keys for the reviewed puzzle and the review's cursor. */
export const PuzzleReviewAttr = {
  selectedReviewPuzzleId: reviewNs.textOrNull(
    'selected-review-puzzle-id',
    readSelectedReviewPuzzleId
  ),
  /** Review timeline cursor; `0` means unset (jump-to-end pending). */
  selectedReviewSolveIdx: reviewNs.integer(
    'selected-review-solve-idx',
    readNonNegativeInteger
  ),
} as const;

export type SelectReviewPuzzlePayload = {
  puzzleId: string | null;
  solveIdx: number;
};

function validateSelectReviewPuzzlePayload(
  payload: unknown
): payload is SelectReviewPuzzlePayload {
  if (!isPlainRecord(payload)) return false;
  if (!('puzzleId' in payload) || !('solveIdx' in payload)) return false;
  if (!isNonNegativeInteger(payload['solveIdx'])) return false;
  const id = payload['puzzleId'];
  if (id === null) return true;
  if (typeof id !== 'string') return false;
  return id.trim().length > 0;
}

function validateSeekPuzzleReviewPayload(
  payload: unknown
): payload is { solveIdx: number } {
  if (!isPlainRecord(payload)) return false;
  return isNonNegativeInteger(payload['solveIdx']);
}

export const puzzleReviewCmdNs = createMessageNamespace('chess-cmd');
export const SelectReviewPuzzle = puzzleReviewCmdNs(
  'set-selected-review-puzzle',
  validateSelectReviewPuzzlePayload
);
export const SeekPuzzleReview = puzzleReviewCmdNs(
  'seek-puzzle-review',
  validateSeekPuzzleReviewPayload
);

export const puzzleReviewEvtNs = createMessageNamespace('chess-evt');
export const ReviewPuzzleSelected = puzzleReviewEvtNs(
  'selected-review-puzzle-set',
  validateSelectReviewPuzzlePayload
);
export const PuzzleReviewSought = puzzleReviewEvtNs(
  'puzzle-review-seek-set',
  validateSeekPuzzleReviewPayload
);

export const puzzleReviewCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(puzzleReviewCmdNs)
  .on(SelectReviewPuzzle, (_state, _identity, cmd) => ({
    ok: true,
    events: [
      ReviewPuzzleSelected({
        puzzleId: cmd.payload.puzzleId,
        solveIdx: cmd.payload.solveIdx,
      }),
    ],
  }))
  .on(SeekPuzzleReview, (_state, _identity, cmd) => ({
    ok: true,
    events: [PuzzleReviewSought({ solveIdx: cmd.payload.solveIdx })],
  }));

export const puzzleReviewEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(puzzleReviewEvtNs)
  .on(ReviewPuzzleSelected, (state, _identity, ev) => ({
    ...state,
    ...PuzzleReviewAttr.selectedReviewPuzzleId(ev.payload.puzzleId),
    ...PuzzleReviewAttr.selectedReviewSolveIdx(ev.payload.solveIdx),
  }))
  .on(PuzzleReviewSought, (state, _identity, ev) => ({
    ...state,
    ...PuzzleReviewAttr.selectedReviewSolveIdx(ev.payload.solveIdx),
  }));
