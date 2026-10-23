import { createMessageRouter } from '@pkgs/message-shared-ts/router';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import { PUZZLE_PLAY_STATUS, PuzzlePlayAttr } from './play-attr';
import {
  PuzzleHintRevealed,
  PuzzleHostReclaimed,
  PuzzleMoveRecommended,
  PuzzlePlayCleared,
  PuzzlePlayMoveAccepted,
  PuzzlePlayMoveRejected,
  PuzzlePlayResetEvt,
  PuzzlePlaySkipped,
  PuzzlePlayStarted,
  PuzzlePlayStepped,
  PuzzleRecommendationCleared,
  PuzzleSolutionRevealed,
  PuzzleSolutionShown,
  puzzlePlayEvtNs,
} from './play-messages';
import {
  decidePuzzleResult,
  PuzzleResultAttr,
  startPuzzleResult,
} from './play-result';
import { clearRecommendation, recommendMove } from './recommendations';

export const puzzlePlayEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(puzzlePlayEvtNs)
  .on(PuzzlePlayStarted, (state, _ctx, ev) => {
    const p = ev.payload;
    return {
      ...state,
      ...startPuzzleResult(p.hostIdentity, p.attemptId),
      ...PuzzlePlayAttr.puzzleId(p.puzzleId),
      ...PuzzlePlayAttr.position(p.fen),
      ...PuzzlePlayAttr.line(p.moves),
      ...PuzzlePlayAttr.hostIdentity(p.hostIdentity),
      ...PuzzlePlayAttr.displayPosition(p.displayFen),
      ...PuzzlePlayAttr.solverSide(p.orientation),
      ...PuzzlePlayAttr.status(p.status),
      ...PuzzlePlayAttr.solveIdx(p.solveIdx),
      ...PuzzlePlayAttr.furthestSolveIdx(p.solveIdx),
      ...PuzzlePlayAttr.layoutKey(0),
      ...PuzzlePlayAttr.wrongAction(null),
      ...PuzzlePlayAttr.wrongMark(null),
      ...PuzzlePlayAttr.hintFrom(null),
      ...PuzzlePlayAttr.hintTo(null),
      ...PuzzlePlayAttr.solutionRevealed(0),
      ...PuzzlePlayAttr.startedAtMs(p.startedAtMs),
      ...PuzzlePlayAttr.endedAtMs(null),
      ...PuzzlePlayAttr.recommendations({}),
    };
  })
  .on(PuzzlePlayMoveAccepted, (state, _ctx, ev) => {
    const prevFurthest = PuzzlePlayAttr.furthestSolveIdx.from(state);
    const nextFurthest = Math.max(prevFurthest, ev.payload.solveIdx);
    return {
      ...state,
      ...(ev.payload.status === PUZZLE_PLAY_STATUS.solved
        ? decidePuzzleResult(
            state,
            'solved',
            PuzzleResultAttr.usedHint.from(state) ? 500 : 1000
          )
        : {}),
      ...PuzzlePlayAttr.line(ev.payload.moves),
      ...PuzzlePlayAttr.displayPosition(ev.payload.displayFen),
      ...PuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
      ...PuzzlePlayAttr.furthestSolveIdx(nextFurthest),
      ...PuzzlePlayAttr.status(ev.payload.status),
      ...PuzzlePlayAttr.wrongAction(null),
      ...PuzzlePlayAttr.wrongMark(null),
      ...PuzzlePlayAttr.hintFrom(null),
      ...PuzzlePlayAttr.hintTo(null),
      ...PuzzlePlayAttr.solutionRevealed(0),
      ...PuzzlePlayAttr.endedAtMs(ev.payload.endedAtMs),
      // The position the suggestions were made for is gone.
      ...PuzzlePlayAttr.recommendations({}),
    };
  })
  // The wrong move is never applied to the reached position: `displayFen`
  // stays put and the board shows the piece on its wrong square from
  // `wrongUci` until a retry (layoutKey resyncs the board).
  .on(PuzzlePlayMoveRejected, (state, _ctx, ev) => ({
    ...state,
    ...decidePuzzleResult(state, 'failed', 500),
    ...PuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...PuzzlePlayAttr.status(PUZZLE_PLAY_STATUS.wrong),
    ...PuzzlePlayAttr.wrongAction(ev.payload.uci),
    ...PuzzlePlayAttr.wrongMark(ev.payload.wrongToSquare),
    ...PuzzlePlayAttr.hintFrom(null),
    ...PuzzlePlayAttr.hintTo(null),
    ...PuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(PuzzlePlayResetEvt, (state, _ctx, ev) => ({
    ...state,
    ...PuzzlePlayAttr.displayPosition(ev.payload.displayFen),
    ...PuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...PuzzlePlayAttr.furthestSolveIdx(ev.payload.furthestSolveIdx),
    ...PuzzlePlayAttr.status(ev.payload.status),
    ...PuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...PuzzlePlayAttr.wrongAction(null),
    ...PuzzlePlayAttr.wrongMark(null),
    ...PuzzlePlayAttr.hintFrom(null),
    ...PuzzlePlayAttr.hintTo(null),
    ...PuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(PuzzlePlayStepped, (state, _ctx, ev) => ({
    ...state,
    ...PuzzlePlayAttr.displayPosition(ev.payload.displayFen),
    ...PuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...PuzzlePlayAttr.status(ev.payload.status),
    ...PuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...PuzzlePlayAttr.wrongAction(null),
    ...PuzzlePlayAttr.wrongMark(null),
    ...PuzzlePlayAttr.hintFrom(null),
    ...PuzzlePlayAttr.hintTo(null),
    ...PuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(PuzzleSolutionShown, (state, _ctx, ev) => ({
    ...state,
    ...decidePuzzleResult(state, 'failed', 0),
    ...PuzzlePlayAttr.displayPosition(ev.payload.displayFen),
    ...PuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...PuzzlePlayAttr.furthestSolveIdx(ev.payload.solveIdx),
    ...PuzzlePlayAttr.status(PUZZLE_PLAY_STATUS.revealed),
    ...PuzzlePlayAttr.endedAtMs(ev.payload.endedAtMs),
    ...PuzzlePlayAttr.wrongAction(null),
    ...PuzzlePlayAttr.wrongMark(null),
    ...PuzzlePlayAttr.hintFrom(null),
    ...PuzzlePlayAttr.hintTo(null),
    ...PuzzlePlayAttr.solutionRevealed(0),
    ...PuzzlePlayAttr.recommendations({}),
  }))
  .on(PuzzlePlaySkipped, (state, _ctx, ev) => ({
    ...state,
    ...decidePuzzleResult(state, 'abandoned', 0),
    ...PuzzlePlayAttr.status(PUZZLE_PLAY_STATUS.skipped),
    ...PuzzlePlayAttr.endedAtMs(ev.payload.endedAtMs),
    ...PuzzlePlayAttr.wrongAction(null),
    ...PuzzlePlayAttr.wrongMark(null),
    ...PuzzlePlayAttr.hintFrom(null),
    ...PuzzlePlayAttr.hintTo(null),
    ...PuzzlePlayAttr.solutionRevealed(0),
    ...PuzzlePlayAttr.recommendations({}),
  }))
  .on(PuzzleMoveRecommended, (state, _ctx, ev) => {
    const next = recommendMove({
      current: PuzzlePlayAttr.recommendations.from(state),
      by: ev.payload.by,
      from: ev.payload.from,
      to: ev.payload.to,
    });
    return {
      ...state,
      ...PuzzlePlayAttr.recommendations(next),
    };
  })
  .on(PuzzleRecommendationCleared, (state, _ctx, ev) => ({
    ...state,
    ...PuzzlePlayAttr.recommendations(
      clearRecommendation(
        PuzzlePlayAttr.recommendations.from(state),
        ev.payload.by
      )
    ),
  }))
  .on(PuzzleHintRevealed, (state, _ctx, ev) => ({
    ...state,
    ...PuzzleResultAttr.usedHint(true),
    ...PuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...PuzzlePlayAttr.hintFrom(ev.payload.fromSquare),
    ...PuzzlePlayAttr.hintTo(ev.payload.toSquare),
    ...PuzzlePlayAttr.solutionRevealed(0),
  }))
  .on(PuzzleSolutionRevealed, (state) => ({
    ...state,
    ...PuzzlePlayAttr.solutionRevealed(1),
  }))
  .on(PuzzleHostReclaimed, (state, _ctx, ev) => ({
    ...state,
    ...PuzzlePlayAttr.hostIdentity(ev.payload.hostIdentity),
  }))
  .on(PuzzlePlayCleared, (state) => ({
    ...state,
    ...startPuzzleResult(null, null),
    ...PuzzlePlayAttr.puzzleId(null),
    ...PuzzlePlayAttr.position(''),
    ...PuzzlePlayAttr.line(''),
    ...PuzzlePlayAttr.hostIdentity(null),
    ...PuzzlePlayAttr.displayPosition(null),
    ...PuzzlePlayAttr.solverSide('white'),
    ...PuzzlePlayAttr.status(PUZZLE_PLAY_STATUS.idle),
    ...PuzzlePlayAttr.solveIdx(0),
    ...PuzzlePlayAttr.furthestSolveIdx(0),
    ...PuzzlePlayAttr.layoutKey(0),
    ...PuzzlePlayAttr.wrongAction(null),
    ...PuzzlePlayAttr.wrongMark(null),
    ...PuzzlePlayAttr.hintFrom(null),
    ...PuzzlePlayAttr.hintTo(null),
    ...PuzzlePlayAttr.solutionRevealed(0),
    ...PuzzlePlayAttr.startedAtMs(null),
    ...PuzzlePlayAttr.endedAtMs(null),
    ...PuzzlePlayAttr.recommendations({}),
  }));

/** Default values to seed in `SpaceModule.initialState()`. */
export function puzzlePlayInitialAttrs(): RoomState {
  return {
    ...startPuzzleResult(null, null),
    ...PuzzlePlayAttr.puzzleId(null),
    ...PuzzlePlayAttr.position(''),
    ...PuzzlePlayAttr.line(''),
    ...PuzzlePlayAttr.hostIdentity(null),
    ...PuzzlePlayAttr.displayPosition(null),
    ...PuzzlePlayAttr.solverSide('white'),
    ...PuzzlePlayAttr.status(PUZZLE_PLAY_STATUS.idle),
    ...PuzzlePlayAttr.solveIdx(0),
    ...PuzzlePlayAttr.furthestSolveIdx(0),
    ...PuzzlePlayAttr.layoutKey(0),
    ...PuzzlePlayAttr.wrongAction(null),
    ...PuzzlePlayAttr.wrongMark(null),
    ...PuzzlePlayAttr.hintFrom(null),
    ...PuzzlePlayAttr.hintTo(null),
    ...PuzzlePlayAttr.solutionRevealed(0),
    ...PuzzlePlayAttr.startedAtMs(null),
    ...PuzzlePlayAttr.endedAtMs(null),
    ...PuzzlePlayAttr.recommendations({}),
  };
}
