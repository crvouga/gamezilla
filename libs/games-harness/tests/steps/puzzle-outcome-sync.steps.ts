/**
 * A puzzle of the run's game finished away from the account: offline, as
 * the app closes, and on two devices acting apart, the result counted
 * first being the one kept.
 */

import {
  finishGamePuzzleAsAppCloses,
  finishGamePuzzleBy,
  finishGamePuzzleOnTwoDevices,
} from '@libs/game-session-harness/puzzle-finishes';
import { viewGamePuzzleStatsOnReturn } from '@libs/game-session-harness/puzzle-result-recovery';
import { Given, When } from '@libs/harness/define';
import type { Actor, PuzzleFinishName } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import { returnToOwnSpace } from '@libs/spaces-harness/space-actions';
import { ensureOnPuzzle, focusPuzzle, puzzleGameId } from './puzzle-world';

/** The other way of the two the scenarios race. */
function otherFinish(first: PuzzleFinishName): PuzzleFinishName {
  return first === 'clean' ? 'wrongRetrySolve' : 'clean';
}

Given(
  '{actor} has finished the puzzle offline by {finish}',
  async (w, actor: Actor, finish: PuzzleFinishName) => {
    await ensureOnPuzzle(w, actor);
    await cutConnection(w, actor);
    await focusPuzzle(w, actor);
    await w.s.apply(finishGamePuzzleBy, actor, puzzleGameId(w), finish);
  }
);

When(
  "{actor}'s attempt finishes on two devices with {competingFinish} counted first",
  async (w, actor: Actor, first: PuzzleFinishName) => {
    await ensureOnPuzzle(w, actor);
    await w.s.apply(finishGamePuzzleOnTwoDevices, {
      actor,
      other: otherDevice(actor),
      gameId: puzzleGameId(w),
      first,
      second: otherFinish(first),
      reconnectOther: true,
    });
  }
);

Given(
  "{actor}'s {competingFinish} result was counted before the other device's {competingFinish} result",
  async (
    w,
    actor: Actor,
    first: PuzzleFinishName,
    second: PuzzleFinishName
  ) => {
    await ensureOnPuzzle(w, actor);
    await w.s.apply(finishGamePuzzleOnTwoDevices, {
      actor,
      other: otherDevice(actor),
      gameId: puzzleGameId(w),
      first,
      second,
      reconnectOther: false,
    });
  }
);

Given(
  '{actor} has finished the puzzle by {finish} as the app closes',
  async (w, actor: Actor, finish: PuzzleFinishName) => {
    // regression: puzzle-result-lost-as-app-closes
    await ensureOnPuzzle(w, actor);
    await focusPuzzle(w, actor);
    await w.s.apply(
      finishGamePuzzleAsAppCloses,
      actor,
      puzzleGameId(w),
      finish
    );
  }
);

Given('{actor} has returned to their space', async (w, actor: Actor) => {
  // regression: harness-room-created-while-offline
  // regression: puzzle-result-lost-by-stats-navigation
  await w.s.apply(returnToOwnSpace, actor);
});

Given(
  '{actor} is viewing their puzzle stats offline',
  async (w, actor: Actor) => {
    await cutConnection(w, actor);
    await w.s.apply(viewGamePuzzleStatsOnReturn, actor, puzzleGameId(w));
  }
);
