import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { changePuzzleAttemptMutation } from './change-attempt-mutation';
import { choosePuzzleContinuationMutation } from './choose-attempt-position-mutation';
import { restartPuzzleAttemptMutation } from './restart-attempt-mutation';
import { startPuzzleAttemptMutation } from './start-attempt-mutation';
import { startPuzzlePlaytestMutation } from './start-playtest-mutation';

export function createAttemptMutations(catalog: PuzzleContentCatalog) {
  return [
    startPuzzleAttemptMutation(catalog),
    startPuzzlePlaytestMutation(catalog),
    changePuzzleAttemptMutation(catalog),
    restartPuzzleAttemptMutation(catalog),
    choosePuzzleContinuationMutation,
  ] as const;
}
