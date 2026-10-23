/**
 * A deleted account's puzzle progress at the run's game: what the account
 * had before deletion (`puzzleProgressBeforeDeletion`, run by
 * `beforeAccountDeletion` in `index.ts` for the puzzle features), and that
 * no device shows it afterwards and no later account inherits it.
 */

import { expect } from 'bun:test';
import { proveAccount } from '@libs/account-privacy-harness-ts/privacy-actions';
import {
  closePuzzleFeedSettings,
  openPuzzleFeedSettings,
  raisePuzzleFeedCustomTarget,
  readFeedTargetLabel,
  setPuzzleFeedMode,
} from '@libs/game-session-harness-ts/puzzle-feed';
import { PUZZLE_RATING_SCALE } from '@libs/game-session-harness-ts/puzzle-fixtures';
import { solveKnownPuzzle } from '@libs/game-session-harness-ts/puzzle-moves';
import { seedPuzzleRating } from '@libs/game-session-harness-ts/puzzle-pool';
import {
  isGameLogEmpty,
  leaveGamePuzzleStats,
  readStatsFigures,
  readStatsPuzzleRating,
  readStatsRatingLabel,
  showPersonalPuzzleStats,
} from '@libs/game-session-harness-ts/puzzle-records';
import { Given, Then } from '@libs/harness-ts/define';
import { localAccountIdOf } from '@libs/harness-ts/identity';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { deviceShowsSignedIn } from '@libs/harness-ts/sign-in-state-reads';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  recall,
  remember,
  signedInAccountKey,
} from '@libs/harness-ts/spec-world';
import {
  enterPuzzles,
  focusStats,
  puzzleGameId,
  SECOND_MS,
} from './puzzle-world';

/**
 * How long a device back online may take to learn its account was deleted
 * when a step names no time: as long as account deletion gives a returning
 * device to be signed out (150 seconds).
 */
const RECONNECT_MS = 150_000;

const DELETED_RATING = 'deleted-puzzle-rating';
const DELETED_LABEL = 'deleted-puzzle-label';
const DELETED_SOLVED = 'deleted-puzzle-solved';
const DELETED_FEED_TARGET = 'deleted-feed-target';

/**
 * `actor`, whose account is about to be deleted, has puzzle progress at the
 * run's game: a settled puzzle rating, a solved puzzle in the game log and
 * a saved custom feed target two steps up, each remembered as shown.
 */
export async function puzzleProgressBeforeDeletion(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(proveAccount, actor);
  await w.s.apply(seedPuzzleRating, actor, puzzleGameId(w), {
    rating: 1800,
    ratingDeviation: PUZZLE_RATING_SCALE.deviationFloor,
    volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
  });
  await enterPuzzles(w, actor);
  await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
  await w.s.apply(openPuzzleFeedSettings, actor);
  await w.s.apply(setPuzzleFeedMode, actor, 'custom');
  await w.s.apply(raisePuzzleFeedCustomTarget, actor, 2);
  await w.s.apply(closePuzzleFeedSettings, actor);
  remember(w, DELETED_FEED_TARGET, await w.s.read(readFeedTargetLabel, actor));
  await focusStats(w, actor);
  remember(w, DELETED_RATING, await w.s.read(readStatsPuzzleRating, actor));
  remember(w, DELETED_LABEL, await w.s.read(readStatsRatingLabel, actor));
  remember(w, DELETED_SOLVED, (await w.s.read(readStatsFigures, actor)).solved);
  await w.s.apply(leaveGamePuzzleStats, actor);
}

Given(
  '{actor} had a settled puzzle rating on the deleted account',
  async (w) => {
    expect(recall(w, DELETED_RATING)).toBeGreaterThan(1500);
    expect(recall(w, DELETED_LABEL)).not.toContain('?');
  }
);

Given(
  "{actor}'s deleted account had solved puzzles in its game log",
  async (w) => {
    expect(recall(w, DELETED_SOLVED)).toBeGreaterThan(0);
  }
);

Given("{actor}'s deleted account had saved a custom feed target", async (w) => {
  expect(recall(w, DELETED_FEED_TARGET)).toMatchObject({ mode: 'custom' });
});

Then(
  "{actor}'s other device cannot show the deleted account's puzzle rating, game log or stats within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const device = otherDevice(actor);
    await w.s.apply(focusActor, device);
    // regression: deleted-account-stats-space-withdrawal
    // Deletion ends the account's spaces; personal stats remain outside them.
    await w.s.apply(showPersonalPuzzleStats, device, puzzleGameId(w));
    // A new solver's stats: no rating earned, no attempt logged or counted.
    await w.s.until(
      async (surf) => ({
        label: await readStatsRatingLabel(surf, device),
        played: (await readStatsFigures(surf, device)).played,
        empty: await isGameLogEmpty(surf, device),
      }),
      {
        maxMs: seconds * SECOND_MS,
        pred: (shown) =>
          shown.label === '1500?' && shown.played === 0 && shown.empty,
      }
    );
  }
);

Then(
  "{actor}'s puzzle rating is 1500 and has not settled",
  async (w, actor: Actor) => {
    await focusStats(w, actor);
    expect(await w.s.read(readStatsPuzzleRating, actor)).toBe(1500);
    expect(await w.s.read(readStatsRatingLabel, actor)).toContain('?');
  }
);

Then(
  "{actor}'s game log cannot show the deleted account's attempts",
  async (w, actor: Actor) => {
    // The device first stops being the deleted account (signed out, or
    // signed in to another one): a device back online learns the account is
    // gone when it next checks its session, within the time deletion allows.
    const deleted = recall(w, signedInAccountKey(actor));
    await w.s.until(
      async (surf) =>
        (await deviceShowsSignedIn(surf, actor))
          ? await localAccountIdOf(surf, actor)
          : 'signed out',
      {
        maxMs: RECONNECT_MS,
        pred: (account) => account !== null && account !== deleted,
      }
    );
    await focusStats(w, actor);
    expect(await w.s.read(isGameLogEmpty, actor)).toBe(true);
  }
);

Then("{actor}'s stats show 0 played and 0 solved", async (w, actor: Actor) => {
  await focusStats(w, actor);
  expect(await w.s.read(readStatsFigures, actor)).toMatchObject({
    played: 0,
    solved: 0,
  });
});
