/**
 * Puzzles of the run's game without a connection: a device that never had
 * any is told they need one (and may still leave), the puzzle already on
 * the board stays playable, days of puzzles keep the feed going, and a
 * result made offline counts once, as the puzzle rating and game log show.
 */

import { expect } from 'bun:test';
import {
  finishGamePuzzleBy,
  solveGamePuzzlesDaily,
} from '@libs/game-session-harness/puzzle-finishes';
import {
  countDevicePuzzles,
  puzzleNamespaceOfGame,
  stockMorePuzzles,
} from '@libs/game-session-harness/puzzle-pool';
import { readPuzzleResultShown } from '@libs/game-session-harness/puzzle-result-recovery';
import {
  isEmptyFeedShown,
  isPuzzleExitOffered,
  isPuzzleOfflineNoticeShown,
  readPuzzleOnBoard,
  readPuzzleProbe,
} from '@libs/game-session-harness/puzzle-screen';
import { restoreActorConnection } from '@libs/harness/actions';
import { Given, Then } from '@libs/harness/define';
import type { Actor, PuzzleFinishName } from '@libs/harness/parameter-types';
import { cutConnection } from '@libs/harness/platform';
import { backToTabs, focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { activeSpaceVisible } from '@libs/spaces-harness/spaces-ui-reads';
import { gameOf } from './game-world';
import {
  currentPuzzle,
  enterPuzzles,
  focusPuzzle,
  focusStats,
  openPuzzles,
  puzzleGameId,
  SECOND_MS,
  SETTLE_MS,
  trackPuzzle,
  withAccount,
} from './puzzle-world';

/** Memo key: how the result made offline was finished. */
const offlineFinishKey = (actor: string) => `puzzle-offline-finish:${actor}`;

// ------------------------------------------------------ never had puzzles

Given(
  '{actor} went offline before any puzzles reached their device',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    if (!(await w.s.read(activeSpaceVisible, actor))) {
      await w.s.apply(backToTabs, actor);
      await w.s.apply(createSpace, actor);
    }
    await cutConnection(w, actor);
  }
);

Given('{actor} has opened puzzles in their space', async (w, actor: Actor) => {
  await openPuzzles(w, actor);
  // Precondition guard: offline, the screen settles on its notice.
  await w.s.until((surf) => isPuzzleOfflineNoticeShown(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

Then(
  '{actor} is told puzzles need a connection within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isPuzzleOfflineNoticeShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor} can return to the space's game choice",
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    expect(await w.s.read(isPuzzleExitOffered, actor)).toBe(true);
  }
);

// --------------------------------------------- the puzzle on the device

Given(
  "{actor}'s current puzzle is already on their device",
  async (w, actor: Actor) => {
    const puzzle = await trackPuzzle(w, actor);
    // Precondition guard: that puzzle is on the board and takes a move.
    expect(await w.s.read(readPuzzleOnBoard, actor)).toBe(puzzle);
    await w.s.until((surf) => readPuzzleProbe(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (probe) => probe?.interactive === true,
    });
  }
);

Then('{actor} can continue the same puzzle', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  await w.s.until(
    async (surf) => ({
      puzzle: await readPuzzleOnBoard(surf, actor),
      probe: await readPuzzleProbe(surf, actor),
    }),
    {
      maxMs: SETTLE_MS,
      pred: (seen) =>
        seen.puzzle === currentPuzzle(w, actor) &&
        seen.probe?.status === 'solving' &&
        seen.probe.interactive,
    }
  );
});

// -------------------------------------------------- days without a connection

Given(
  '{actor} has solved {int} puzzles a day for {int} days',
  async (w, actor: Actor, perDay: number, days: number) => {
    // Enough puzzles of the game reached the device before those days: one
    // more for each solve, beside the game's known puzzles.
    const solves = perDay * days;
    const namespace = puzzleNamespaceOfGame(gameOf(w));
    await w.s.apply(restoreActorConnection, actor);
    await w.s.apply(stockMorePuzzles, puzzleGameId(w), solves);
    await w.s.until((surf) => countDevicePuzzles(surf, actor, namespace), {
      maxMs: SETTLE_MS,
      pred: (held) => held > solves,
    });
    await cutConnection(w, actor);
    await focusPuzzle(w, actor);
    await w.s.apply(solveGamePuzzlesDaily, actor, puzzleGameId(w), {
      perDay,
      days,
    });
    await trackPuzzle(w, actor);
  }
);

Then('{actor} is not told the feed is empty', async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  expect(await w.s.read(isEmptyFeedShown, actor)).toBe(false);
});

// ------------------------------------------------- a result made offline

async function finishedOffline(
  w: HarnessWorld,
  actor: Actor,
  finish: PuzzleFinishName
): Promise<void> {
  await withAccount(w, actor);
  await enterPuzzles(w, actor);
  await cutConnection(w, actor);
  await focusPuzzle(w, actor);
  await w.s.apply(finishGamePuzzleBy, actor, puzzleGameId(w), finish);
  w.memo.set(offlineFinishKey(actor), finish);
}

Given('{actor} has solved a rated puzzle while offline', (w, actor: Actor) =>
  finishedOffline(w, actor, 'clean')
);

Given(
  '{actor} has played a wrong move and then solved the same puzzle while offline',
  (w, actor: Actor) => finishedOffline(w, actor, 'wrongRetrySolve')
);

/** What `actor`'s stats show of the puzzle finished offline. */
async function resultShown(w: HarnessWorld, actor: Actor) {
  await focusStats(w, actor);
  return w.s.until(
    (surf) =>
      readPuzzleResultShown(
        surf,
        actor,
        puzzleGameId(w),
        currentPuzzle(w, actor)
      ),
    { maxMs: SETTLE_MS, pred: (shown) => shown.gameLog !== 'unfinished' }
  );
}

Then(
  "{actor}'s game log contains that solved puzzle exactly once",
  async (w, actor: Actor) => {
    expect((await resultShown(w, actor)).gameLog).toBe('solved');
  }
);

Then(
  "{actor}'s game log keeps the failed first result exactly once",
  async (w, actor: Actor) => {
    expect((await resultShown(w, actor)).gameLog).toBe('failed');
  }
);

Then(
  "{actor}'s puzzle rating counts that first result exactly once",
  async (w, actor: Actor) => {
    const finish = w.memo.get(offlineFinishKey(actor));
    expect((await resultShown(w, actor)).ratedResult).toBe(
      finish === 'clean' ? 'CleanSolve' : 'WrongMove'
    );
  }
);
