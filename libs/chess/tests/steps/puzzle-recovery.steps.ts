import { returnToOwnSpace } from '@libs/chess/harness/chess-actions';
import { finishPuzzleAsAppCloses } from '@libs/chess/harness/puzzle-close-during-finish';
import { type Actor, Given } from '@libs/harness/spec/define';
import type { PuzzleFinishName } from '@libs/harness/spec/parameter-types';

Given(
  '{actor} has finished the puzzle by {finish} as the app closes',
  async (w, actor: Actor, finish: PuzzleFinishName) => {
    // regression: puzzle-result-lost-as-app-closes
    await w.s.apply(finishPuzzleAsAppCloses, actor, finish);
  }
);

Given('{actor} has returned to their space', async (w, actor: Actor) => {
  // regression: harness-room-created-while-offline
  // regression: puzzle-result-lost-by-stats-navigation
  await w.s.apply(returnToOwnSpace, actor);
});
