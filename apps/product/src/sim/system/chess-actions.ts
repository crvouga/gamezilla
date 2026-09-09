import { scenarioAction } from './actor-ui';
import {
  openPuzzlePlay,
  settleAfterPuzzleNext,
  solvePuzzle,
  pressPuzzleNext as tapPuzzleNext,
} from './chess-puzzle-ui';

export const openPuzzleFromSpace = scenarioAction({
  name: 'openPuzzleFromSpace',
  act: openPuzzlePlay,
});

export const playUntilSolved = scenarioAction({
  name: 'playUntilSolved',
  act: solvePuzzle,
});

/**
 * Presses Next and waits until a different puzzle is active (or loading
 * finishes). The standing `nextPuzzleDifferent` property asserts the id
 * actually changed.
 */
export const pressPuzzleNext = scenarioAction({
  name: 'pressPuzzleNext',
  act: async (s, actorId: string) => {
    await tapPuzzleNext(s, actorId);
    await settleAfterPuzzleNext(s, actorId);
  },
});
