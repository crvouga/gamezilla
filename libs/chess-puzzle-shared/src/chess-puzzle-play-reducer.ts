import { createMessageRouter } from '@pkgs/message-shared/router';
import type { RoomState } from '@pkgs/room-shared/types';
import {
  clearRecommendation,
  recommendMove,
} from './recommendations';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
} from './chess-puzzle-play-attr';
import {
  ChessPuzzleHintRevealed,
  ChessPuzzleHostReclaimed,
  ChessPuzzleMoveRecommended,
  ChessPuzzlePlayCleared,
  ChessPuzzlePlayMoveAccepted,
  ChessPuzzlePlayMoveRejected,
  ChessPuzzlePlayResetEvt,
  ChessPuzzlePlaySkipped,
  ChessPuzzlePlayStarted,
  ChessPuzzlePlayStepped,
  ChessPuzzleRecommendationCleared,
  ChessPuzzleSolutionRevealed,
  ChessPuzzleSolutionShown,
  chessPuzzlePlayEvtNs,
} from './chess-puzzle-play-messages';
import {
  ChessPuzzleResultAttr,
  decidePuzzleResult,
  startPuzzleResult,
} from './chess-puzzle-result';

export const chessPuzzlePlayEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessPuzzlePlayEvtNs)
  .on(ChessPuzzlePlayStarted, (state, _ctx, ev) => {
    const p = ev.payload;
    return {
      ...state,
      ...startPuzzleResult(p.hostIdentity, p.attemptId),
      ...ChessPuzzlePlayAttr.puzzleId(p.puzzleId),
      ...ChessPuzzlePlayAttr.fen(p.fen),
      ...ChessPuzzlePlayAttr.moves(p.moves),
      ...ChessPuzzlePlayAttr.hostIdentity(p.hostIdentity),
      ...ChessPuzzlePlayAttr.displayFen(p.displayFen),
      ...ChessPuzzlePlayAttr.orientation(p.orientation),
      ...ChessPuzzlePlayAttr.status(p.status),
      ...ChessPuzzlePlayAttr.solveIdx(p.solveIdx),
      ...ChessPuzzlePlayAttr.furthestSolveIdx(p.solveIdx),
      ...ChessPuzzlePlayAttr.layoutKey(0),
      ...ChessPuzzlePlayAttr.wrongUci(null),
      ...ChessPuzzlePlayAttr.wrongFromSquare(null),
      ...ChessPuzzlePlayAttr.wrongToSquare(null),
      ...ChessPuzzlePlayAttr.expectedFromSquare(null),
      ...ChessPuzzlePlayAttr.expectedToSquare(null),
      ...ChessPuzzlePlayAttr.solutionRevealed(0),
      ...ChessPuzzlePlayAttr.startedAtMs(p.startedAtMs),
      ...ChessPuzzlePlayAttr.endedAtMs(null),
      ...ChessPuzzlePlayAttr.recommendations({}),
    };
  })
  .on(ChessPuzzlePlayMoveAccepted, (state, _ctx, ev) => {
    const prevFurthest = ChessPuzzlePlayAttr.furthestSolveIdx.from(state);
    const nextFurthest = Math.max(prevFurthest, ev.payload.solveIdx);
    return {
      ...state,
      ...(ev.payload.status === CHESS_PUZZLE_PLAY_STATUS.solved
        ? decidePuzzleResult(
            state,
            'solved',
            ChessPuzzleResultAttr.usedHint.from(state) ? 500 : 1000
          )
        : {}),
      ...ChessPuzzlePlayAttr.moves(ev.payload.moves),
      ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
      ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
      ...ChessPuzzlePlayAttr.furthestSolveIdx(nextFurthest),
      ...ChessPuzzlePlayAttr.status(ev.payload.status),
      ...ChessPuzzlePlayAttr.wrongUci(null),
      ...ChessPuzzlePlayAttr.wrongFromSquare(null),
      ...ChessPuzzlePlayAttr.wrongToSquare(null),
      ...ChessPuzzlePlayAttr.expectedFromSquare(null),
      ...ChessPuzzlePlayAttr.expectedToSquare(null),
      ...ChessPuzzlePlayAttr.solutionRevealed(0),
      ...ChessPuzzlePlayAttr.endedAtMs(ev.payload.endedAtMs),
      // The position the suggestions were made for is gone.
      ...ChessPuzzlePlayAttr.recommendations({}),
    };
  })
  // The wrong move is never applied: the display stays put, so the dragged
  // piece snaps back (layoutKey remounts the board on the same FEN).
  .on(ChessPuzzlePlayMoveRejected, (state, _ctx, ev) => ({
    ...state,
    ...decidePuzzleResult(state, 'failed', 500),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.wrong),
    ...ChessPuzzlePlayAttr.wrongUci(ev.payload.uci),
    ...ChessPuzzlePlayAttr.wrongFromSquare(ev.payload.wrongFromSquare),
    ...ChessPuzzlePlayAttr.wrongToSquare(ev.payload.wrongToSquare),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(ChessPuzzlePlayResetEvt, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.furthestSolveIdx(ev.payload.furthestSolveIdx),
    ...ChessPuzzlePlayAttr.status(ev.payload.status),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.wrongUci(null),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(ChessPuzzlePlayStepped, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.status(ev.payload.status),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.wrongUci(null),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(ChessPuzzleSolutionShown, (state, _ctx, ev) => ({
    ...state,
    ...decidePuzzleResult(state, 'failed', 0),
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.furthestSolveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.revealed),
    ...ChessPuzzlePlayAttr.endedAtMs(ev.payload.endedAtMs),
    ...ChessPuzzlePlayAttr.wrongUci(null),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
    ...ChessPuzzlePlayAttr.recommendations({}),
  }))
  .on(ChessPuzzlePlaySkipped, (state, _ctx, ev) => ({
    ...state,
    ...decidePuzzleResult(state, 'abandoned', 0),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.skipped),
    ...ChessPuzzlePlayAttr.endedAtMs(ev.payload.endedAtMs),
    ...ChessPuzzlePlayAttr.wrongUci(null),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
    ...ChessPuzzlePlayAttr.recommendations({}),
  }))
  .on(ChessPuzzleMoveRecommended, (state, _ctx, ev) => {
    const next = recommendMove({
      current: ChessPuzzlePlayAttr.recommendations.from(state),
      by: ev.payload.by,
      from: ev.payload.from,
      to: ev.payload.to,
    });
    return {
      ...state,
      ...ChessPuzzlePlayAttr.recommendations(next),
    };
  })
  .on(ChessPuzzleRecommendationCleared, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.recommendations(
      clearRecommendation(
        ChessPuzzlePlayAttr.recommendations.from(state),
        ev.payload.by
      )
    ),
  }))
  .on(ChessPuzzleHintRevealed, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzleResultAttr.usedHint(true),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.expectedFromSquare(ev.payload.fromSquare),
    ...ChessPuzzlePlayAttr.expectedToSquare(ev.payload.toSquare),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(ChessPuzzleSolutionRevealed, (state) => ({
    ...state,
    ...ChessPuzzlePlayAttr.solutionRevealed(1),
  }))
  .on(ChessPuzzleHostReclaimed, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.hostIdentity(ev.payload.hostIdentity),
  }))
  .on(ChessPuzzlePlayCleared, (state) => ({
    ...state,
    ...startPuzzleResult(null, null),
    ...ChessPuzzlePlayAttr.puzzleId(null),
    ...ChessPuzzlePlayAttr.fen(''),
    ...ChessPuzzlePlayAttr.moves(''),
    ...ChessPuzzlePlayAttr.hostIdentity(null),
    ...ChessPuzzlePlayAttr.displayFen(null),
    ...ChessPuzzlePlayAttr.orientation('white'),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.idle),
    ...ChessPuzzlePlayAttr.solveIdx(0),
    ...ChessPuzzlePlayAttr.furthestSolveIdx(0),
    ...ChessPuzzlePlayAttr.layoutKey(0),
    ...ChessPuzzlePlayAttr.wrongUci(null),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
    ...ChessPuzzlePlayAttr.startedAtMs(null),
    ...ChessPuzzlePlayAttr.endedAtMs(null),
    ...ChessPuzzlePlayAttr.recommendations({}),
  }));

/** Default values to seed in `SpaceModule.initialState()`. */
export function chessPuzzlePlayInitialAttrs(): RoomState {
  return {
    ...startPuzzleResult(null, null),
    ...ChessPuzzlePlayAttr.puzzleId(null),
    ...ChessPuzzlePlayAttr.fen(''),
    ...ChessPuzzlePlayAttr.moves(''),
    ...ChessPuzzlePlayAttr.hostIdentity(null),
    ...ChessPuzzlePlayAttr.displayFen(null),
    ...ChessPuzzlePlayAttr.orientation('white'),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.idle),
    ...ChessPuzzlePlayAttr.solveIdx(0),
    ...ChessPuzzlePlayAttr.furthestSolveIdx(0),
    ...ChessPuzzlePlayAttr.layoutKey(0),
    ...ChessPuzzlePlayAttr.wrongUci(null),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
    ...ChessPuzzlePlayAttr.startedAtMs(null),
    ...ChessPuzzlePlayAttr.endedAtMs(null),
    ...ChessPuzzlePlayAttr.recommendations({}),
  };
}
