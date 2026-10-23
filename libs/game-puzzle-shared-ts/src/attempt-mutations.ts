import { changePuzzleAttemptMutation } from './change-attempt-mutation';
import { choosePuzzleContinuationMutation } from './choose-attempt-position-mutation';
import { restartPuzzleAttemptMutation } from './restart-attempt-mutation';
import { startPuzzleAttemptMutation } from './start-attempt-mutation';
import { startPuzzlePlaytestMutation } from './start-playtest-mutation';

export const ATTEMPT_MUTATIONS = [
  startPuzzleAttemptMutation,
  startPuzzlePlaytestMutation,
  changePuzzleAttemptMutation,
  restartPuzzleAttemptMutation,
  choosePuzzleContinuationMutation,
] as const;
