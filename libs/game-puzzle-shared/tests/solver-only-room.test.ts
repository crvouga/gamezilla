import { expect, test } from 'bun:test';
import { PuzzlePlayAttr } from '@libs/game-puzzle-shared/play-attr';
import {
  StartPuzzlePlay,
  StepBackPuzzlePlay,
  SubmitPuzzleMove,
} from '@libs/game-puzzle-shared/play-messages';
import {
  puzzlePlayEventReducer,
  puzzlePlayInitialAttrs,
} from '@libs/game-puzzle-shared/play-reducer';
import { PuzzleResultAttr } from '@libs/game-puzzle-shared/play-result';
import { createPuzzlePlayCommandRouter } from '@libs/game-puzzle-shared/play-router';
import { isMessageEnvelope } from '@pkgs/message-shared/message';
import type {
  RoomCommandPayload,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { SOLO_PILE_GAME as GAME } from './solver-only-game';

const commands = createPuzzlePlayCommandRouter((position) =>
  GAME.rules.recognizes(position) ? GAME : null
);

function apply(
  state: RoomState,
  command: RoomCommandPayload,
  id: string
): RoomState {
  if (!isMessageEnvelope(command)) throw new Error('Expected an envelope');
  const result = commands.dispatch(
    state,
    {
      identity: 'solver',
      ts: 1000,
      commandId: id,
      random: () => 0,
      authority: true,
    },
    command,
    () => {
      throw new Error('Unrecognized puzzle command');
    }
  );
  if (!result.ok)
    throw new Error(`Puzzle command refused: ${JSON.stringify(result.error)}`);
  return result.events.reduce<RoomState>((next, event) => {
    if (!isMessageEnvelope(event))
      throw new Error('Expected an event envelope');
    return puzzlePlayEventReducer.dispatch(next, undefined, event, () => {
      throw new Error('Unrecognized puzzle event');
    });
  }, state);
}

function started(): RoomState {
  return apply(
    puzzlePlayInitialAttrs(),
    StartPuzzlePlay({
      puzzleId: 'pile/solo-four',
      fen: 'pile:4:white',
      moves: 'take2 take2',
    }),
    'start'
  );
}

test('the shared room waits for both solo solver moves and records one clean solve', () => {
  let state = started();
  expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(0);
  expect(PuzzlePlayAttr.displayPosition.from(state)).toBe('pile:4:white');
  state = apply(state, SubmitPuzzleMove({ uci: 'take2' }), 'first');
  expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(1);
  expect(PuzzlePlayAttr.displayPosition.from(state)).toBe('pile:2:white');
  expect(PuzzlePlayAttr.status.from(state)).toBe('solving');
  state = apply(state, SubmitPuzzleMove({ uci: 'take2' }), 'last');
  expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(2);
  expect(PuzzlePlayAttr.displayPosition.from(state)).toBe('pile:0:white');
  expect(PuzzlePlayAttr.status.from(state)).toBe('solved');
  expect(PuzzleResultAttr.outcome.from(state)).toBe('solved');
  expect(PuzzleResultAttr.score.from(state)).toBe(1000);
});

// regression: solo-puzzle-review-excludes-initial-position
test('the solo solver can review the supplied position after the first move', () => {
  const first = apply(started(), SubmitPuzzleMove({ uci: 'take2' }), 'first');
  const back = apply(first, StepBackPuzzlePlay({}), 'back');
  expect(PuzzlePlayAttr.solveIdx.from(back)).toBe(0);
  expect(PuzzlePlayAttr.displayPosition.from(back)).toBe('pile:4:white');
  expect(PuzzlePlayAttr.furthestSolveIdx.from(back)).toBe(1);
});
