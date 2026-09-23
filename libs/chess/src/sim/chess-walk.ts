/**
 * Chess puzzles' monkey steps: open the puzzle board from a space's game
 * menu, solve or fumble the puzzle on it, move on to the next. Every step is
 * checked against the standing properties (no crash screen, the global menu
 * always reachable, Next never repeats the active puzzle).
 */

import { visible, walkAction } from '@libs/sim-harness/system/walk-action';
import { Handles } from '@libs/test-ids';

import { isPuzzleBoardInteractive } from './chess-puzzle-solve-ui';
import {
  openPuzzlePlay,
  playWrongMove,
  pressPuzzleNext,
  readPuzzleStatus,
  settleAfterPuzzleNext,
  solvePuzzle,
} from './chess-puzzle-ui';

export const walkOpenPuzzle = walkAction({
  name: 'walkOpenPuzzle',
  weight: 2,
  applies: (step) => visible(step, Handles.gameMenuChess),
  act: ({ s, actorId }) => openPuzzlePlay(s, actorId),
});

/** Solve most of the time; now and then play a legal wrong move. */
export const walkPlayPuzzle = walkAction({
  name: 'walkPlayPuzzle',
  weight: 3,
  applies: async (step) =>
    (await visible(step, Handles.chessPuzzleBoard)) &&
    (await readPuzzleStatus(step.s, step.actorId)) === 'solving' &&
    (await isPuzzleBoardInteractive(step.s, step.actorId)),
  act: ({ s, actorId, pick }) =>
    pick < 0.7 ? solvePuzzle(s, actorId) : playWrongMove(s, actorId),
});

export const walkNextPuzzle = walkAction({
  name: 'walkNextPuzzle',
  weight: 2,
  applies: (step) => visible(step, Handles.chessPuzzleActionNext),
  act: async ({ s, actorId }) => {
    await pressPuzzleNext(s, actorId);
    await settleAfterPuzzleNext(s, actorId);
  },
});

export const CHESS_WALK_ACTIONS = [
  walkOpenPuzzle,
  walkPlayPuzzle,
  walkNextPuzzle,
];
