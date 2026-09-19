import { createMessageRouter } from '@pkgs/message';
import type { RoomState } from '@pkgs/room';

import {
  clearRecommendation,
  recommendMove,
} from '../puzzle-session/recommendations';
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
  chessPuzzlePlayEvtNs,
} from './chess-puzzle-play-messages';

export const chessPuzzlePlayEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessPuzzlePlayEvtNs)
  .on(ChessPuzzlePlayStarted, (state, _ctx, ev) => {
    const p = ev.payload;
    return {
      ...state,
      ...ChessPuzzlePlayAttr.puzzleId(p.puzzleId),
      ...ChessPuzzlePlayAttr.fen(p.fen),
      ...ChessPuzzlePlayAttr.moves(p.moves),
      ...ChessPuzzlePlayAttr.hostIdentity(p.hostIdentity),
      ...ChessPuzzlePlayAttr.displayFen(p.displayFen),
      ...ChessPuzzlePlayAttr.previousDisplayFen(null),
      ...ChessPuzzlePlayAttr.orientation(p.orientation),
      ...ChessPuzzlePlayAttr.status(p.status),
      ...ChessPuzzlePlayAttr.solveIdx(p.solveIdx),
      ...ChessPuzzlePlayAttr.furthestSolveIdx(p.solveIdx),
      ...ChessPuzzlePlayAttr.layoutKey(0),
      ...ChessPuzzlePlayAttr.wrongFromSquare(null),
      ...ChessPuzzlePlayAttr.wrongToSquare(null),
      ...ChessPuzzlePlayAttr.expectedFromSquare(null),
      ...ChessPuzzlePlayAttr.expectedToSquare(null),
      ...ChessPuzzlePlayAttr.solutionRevealed(0),
      ...ChessPuzzlePlayAttr.startedAtMs(p.startedAtMs),
      ...ChessPuzzlePlayAttr.endedAtMs(null),
      ...ChessPuzzlePlayAttr.recommendations({}),
      ...ChessPuzzlePlayAttr.recommendationSeq(0),
    };
  })
  .on(ChessPuzzlePlayMoveAccepted, (state, _ctx, ev) => {
    const prevFurthest = ChessPuzzlePlayAttr.furthestSolveIdx.from(state);
    const nextFurthest = Math.max(prevFurthest, ev.payload.solveIdx);
    return {
      ...state,
      ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
      ...ChessPuzzlePlayAttr.previousDisplayFen(null),
      ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
      ...ChessPuzzlePlayAttr.furthestSolveIdx(nextFurthest),
      ...ChessPuzzlePlayAttr.status(ev.payload.status),
      ...ChessPuzzlePlayAttr.wrongFromSquare(null),
      ...ChessPuzzlePlayAttr.wrongToSquare(null),
      ...ChessPuzzlePlayAttr.expectedFromSquare(null),
      ...ChessPuzzlePlayAttr.expectedToSquare(null),
      ...ChessPuzzlePlayAttr.solutionRevealed(0),
      ...ChessPuzzlePlayAttr.endedAtMs(ev.payload.endedAtMs),
      // The position the suggestions were made for is gone.
      ...ChessPuzzlePlayAttr.recommendations({}),
      ...ChessPuzzlePlayAttr.recommendationSeq(0),
    };
  })
  .on(ChessPuzzlePlayMoveRejected, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.previousDisplayFen(ev.payload.previousDisplayFen),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.wrong),
    ...ChessPuzzlePlayAttr.wrongFromSquare(ev.payload.wrongFromSquare),
    ...ChessPuzzlePlayAttr.wrongToSquare(ev.payload.wrongToSquare),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(ChessPuzzlePlayResetEvt, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.previousDisplayFen(null),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.furthestSolveIdx(ev.payload.furthestSolveIdx),
    ...ChessPuzzlePlayAttr.status(ev.payload.status),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(ChessPuzzlePlayStepped, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.previousDisplayFen(null),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.status(ev.payload.status),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(ChessPuzzlePlaySkipped, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.skipped),
    ...ChessPuzzlePlayAttr.endedAtMs(ev.payload.endedAtMs),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
    ...ChessPuzzlePlayAttr.recommendations({}),
    ...ChessPuzzlePlayAttr.recommendationSeq(0),
  }))
  .on(ChessPuzzleMoveRecommended, (state, _ctx, ev) => {
    const next = recommendMove({
      current: ChessPuzzlePlayAttr.recommendations.from(state),
      by: ev.payload.by,
      from: ev.payload.from,
      to: ev.payload.to,
    });
    const seq = next[ev.payload.by]?.seq ?? 0;
    return {
      ...state,
      ...ChessPuzzlePlayAttr.recommendations(next),
      ...ChessPuzzlePlayAttr.recommendationSeq(seq),
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
    ...ChessPuzzlePlayAttr.puzzleId(null),
    ...ChessPuzzlePlayAttr.fen(''),
    ...ChessPuzzlePlayAttr.moves(''),
    ...ChessPuzzlePlayAttr.hostIdentity(null),
    ...ChessPuzzlePlayAttr.displayFen(null),
    ...ChessPuzzlePlayAttr.previousDisplayFen(null),
    ...ChessPuzzlePlayAttr.orientation('white'),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.idle),
    ...ChessPuzzlePlayAttr.solveIdx(0),
    ...ChessPuzzlePlayAttr.furthestSolveIdx(0),
    ...ChessPuzzlePlayAttr.layoutKey(0),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
    ...ChessPuzzlePlayAttr.startedAtMs(null),
    ...ChessPuzzlePlayAttr.endedAtMs(null),
    ...ChessPuzzlePlayAttr.recommendations({}),
    ...ChessPuzzlePlayAttr.recommendationSeq(0),
  }));

/** Default values to seed in `SpaceModule.initialState()`. */
export function chessPuzzlePlayInitialAttrs(): RoomState {
  return {
    ...ChessPuzzlePlayAttr.puzzleId(null),
    ...ChessPuzzlePlayAttr.fen(''),
    ...ChessPuzzlePlayAttr.moves(''),
    ...ChessPuzzlePlayAttr.hostIdentity(null),
    ...ChessPuzzlePlayAttr.displayFen(null),
    ...ChessPuzzlePlayAttr.previousDisplayFen(null),
    ...ChessPuzzlePlayAttr.orientation('white'),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.idle),
    ...ChessPuzzlePlayAttr.solveIdx(0),
    ...ChessPuzzlePlayAttr.furthestSolveIdx(0),
    ...ChessPuzzlePlayAttr.layoutKey(0),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
    ...ChessPuzzlePlayAttr.solutionRevealed(0),
    ...ChessPuzzlePlayAttr.startedAtMs(null),
    ...ChessPuzzlePlayAttr.endedAtMs(null),
    ...ChessPuzzlePlayAttr.recommendations({}),
    ...ChessPuzzlePlayAttr.recommendationSeq(0),
  };
}
