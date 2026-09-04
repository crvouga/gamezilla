import { scenarioAction } from './actor-ui';
import {
  openPuzzlePlay,
  solvePuzzle,
  waitPuzzleSolved,
} from './chess-puzzle-ui';

export const openPuzzleFromSpace = scenarioAction({
  name: 'openPuzzleFromSpace',
  act: openPuzzlePlay,
});

export const playUntilSolved = scenarioAction({
  name: 'playUntilSolved',
  act: solvePuzzle,
});

export const expectPuzzleSolved = scenarioAction({
  name: 'expectPuzzleSolved',
  act: waitPuzzleSolved,
});
