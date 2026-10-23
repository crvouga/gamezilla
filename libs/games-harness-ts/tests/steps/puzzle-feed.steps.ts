/**
 * The puzzle feed of the run's game as a solver customizes it: the feed
 * settings (history filter, rating offset, custom target, auto-advance,
 * a theme of the game) previewed, saved or discarded, what the feed bar
 * says, a feed limited to a theme, "Failed", the guest's invitation, and
 * the choices on the solver's other device.
 */

import { expect } from 'bun:test';
import type {
  FeedHistoryFilter,
  FeedMode,
} from '@libs/game-session-harness-ts/puzzle-feed';
import {
  clearPuzzleFeedTheme,
  closePuzzleFeedSettings,
  closePuzzleFeedSettingsNoWait,
  discardFeedSettings,
  includePlayedPuzzles,
  isFeedLimitedToTheme,
  isFeedSignInInviteVisible,
  lowerPuzzleFeedCustomTarget,
  lowerPuzzleFeedOffset,
  openPuzzleFeedSettings,
  raisePuzzleFeedCustomTarget,
  raisePuzzleFeedOffset,
  readFeedHistoryLabel,
  readFeedModalPool,
  readFeedModalTargetRating,
  readFeedOffsetValue,
  readFeedTargetLabel,
  savePuzzleFeedSettings,
  setPuzzleFeedHistory,
  setPuzzleFeedMode,
  setPuzzleFeedTheme,
} from '@libs/game-session-harness-ts/puzzle-feed';
import {
  previewPuzzleFeedChoice,
  readSavedFeedChoice,
} from '@libs/game-session-harness-ts/puzzle-feed-choices';
import {
  solveKnownPuzzle,
  theKnownPuzzle,
} from '@libs/game-session-harness-ts/puzzle-moves';
import {
  isEmptyFeedForNoFailedAttempts,
  isEmptyFeedShown,
  readPuzzleOnBoard,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { cutConnection } from '@libs/harness-ts/platform';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf } from './game-world';
import {
  failedPuzzlesKey,
  feedTheme,
  focusPuzzle,
  openPuzzles,
  otherDevicePuzzles,
  puzzleGameId,
  rememberThemed,
  required,
  SECOND_MS,
  SETTLE_MS,
  servedPuzzle,
  themedPuzzles,
  themesWith,
  trackPuzzle,
  writePool,
} from './puzzle-world';
import { themePool } from './theme-pool';

const HISTORY_FILTERS: Readonly<Record<string, FeedHistoryFilter>> = {
  Any: 'any',
  Unseen: 'neverSeen',
  Seen: 'seen',
  Failed: 'failed',
};

function historyFilter(label: string): FeedHistoryFilter {
  const filter = HISTORY_FILTERS[label];
  if (filter === undefined) throw new Error(`no history filter "${label}"`);
  return filter;
}

/** `device`'s feed bar comes to target `rating`, by `mode`. */
async function untilFeedTarget(
  w: HarnessWorld,
  device: string,
  target: { mode: FeedMode; rating: number },
  maxMs = SETTLE_MS
): Promise<void> {
  await focusPuzzle(w, device);
  await w.s.until((surf) => readFeedTargetLabel(surf, device), {
    maxMs,
    pred: (label) =>
      label?.mode === target.mode && label.rating === target.rating,
  });
}

/** Note the puzzle a save placed, if the feed placed one. */
async function trackIfPlaced(w: HarnessWorld, actor: Actor): Promise<void> {
  if ((await w.s.read(readPuzzleOnBoard, actor)) !== null)
    await trackPuzzle(w, actor);
}

/** Open the settings with a custom target `steps` up, unsaved. */
async function chooseCustomTarget(
  w: HarnessWorld,
  actor: Actor,
  steps: number
): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openPuzzleFeedSettings, actor);
  await w.s.apply(setPuzzleFeedMode, actor, 'custom');
  await w.s.apply(raisePuzzleFeedCustomTarget, actor, steps);
}

/** Limit the feed to the scenario's theme and save. */
async function limitToTheme(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openPuzzleFeedSettings, actor);
  await w.s.apply(setPuzzleFeedTheme, actor, puzzleGameId(w), feedTheme(w));
  await w.s.apply(closePuzzleFeedSettingsNoWait, actor);
}

// ------------------------------------------------------- opening the feed

When('{actor} opens puzzles in their space', async (w, actor: Actor) => {
  await openPuzzles(w, actor);
});

Then('{actor} has a puzzle on the board', async (w, actor: Actor) => {
  await servedPuzzle(w, actor);
});

// What the person has in view now: going back to the puzzles would bring
// one back.
Then('{actor} has no puzzle on the board', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(readPuzzleOnBoard, actor)).toBeNull();
});

Then(
  '{actor} is told the feed is empty within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isEmptyFeedShown(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

// ------------------------------------------------------------ the feed bar

Then(
  "{actor}'s feed history shows {string}",
  async (w, actor: Actor, label: string) => {
    await focusPuzzle(w, actor);
    await w.s.until((surf) => readFeedHistoryLabel(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (shown) => shown === label,
    });
  }
);

Then(
  "{actor}'s feed targets {int} automatically",
  async (w, actor: Actor, rating: number) => {
    await untilFeedTarget(w, actor, { mode: 'auto', rating });
  }
);

Then(
  "{actor}'s feed targets a custom {int}",
  async (w, actor: Actor, rating: number) => {
    await untilFeedTarget(w, actor, { mode: 'custom', rating });
  }
);

// ------------------------------------------------------- editing the feed

Given('{actor} is editing the feed settings', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openPuzzleFeedSettings, actor);
});

When('{actor} starts editing the feed settings', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.apply(openPuzzleFeedSettings, actor);
});

When('{actor} saves the feed settings', async (w, actor: Actor) => {
  await w.s.apply(savePuzzleFeedSettings, actor);
  await trackIfPlaced(w, actor);
});

When(
  '{actor} closes the feed settings without saving',
  async (w, actor: Actor) => {
    await w.s.apply(discardFeedSettings, actor);
  }
);

Given(
  '{actor} has chosen {string} for the unsaved feed history',
  async (w, actor: Actor, label: string) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedHistory, actor, historyFilter(label));
  }
);

Given(
  '{actor} has changed the feed history to {string} and saved the feed settings',
  async (w, actor: Actor, label: string) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedHistory, actor, historyFilter(label));
    await w.s.apply(savePuzzleFeedSettings, actor);
    await trackIfPlaced(w, actor);
  }
);

Then(
  "{actor}'s unsaved feed settings preview a target of {int}",
  async (w, actor: Actor, rating: number) => {
    expect(await w.s.read(readFeedModalTargetRating, actor)).toBe(rating);
  }
);

Then(
  "{actor}'s feed settings show a pool of at least one matching puzzle",
  async (w, actor: Actor) => {
    const pool = required(
      await w.s.read(readFeedModalPool, actor),
      'the pool the settings show'
    );
    expect(pool.matched).toBeGreaterThan(0);
  }
);

Then(
  '{actor} cannot customize the feed without an account',
  async (w, actor: Actor) => {
    expect(await w.s.read(isFeedSignInInviteVisible, actor)).toBe(true);
  }
);

// ------------------------------------------------------ the rating offset

When(
  '{actor} raises the feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(raisePuzzleFeedOffset, actor, steps);
  }
);

When(
  '{actor} lowers the feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(lowerPuzzleFeedOffset, actor, steps);
  }
);

Given(
  '{actor} has raised the unsaved feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(raisePuzzleFeedOffset, actor, steps);
  }
);

Given(
  '{actor} has lowered the unsaved feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(lowerPuzzleFeedOffset, actor, steps);
  }
);

Then(
  "{actor}'s feed rating offset is {int}",
  async (w, actor: Actor, offset: number) => {
    expect(await w.s.read(readFeedOffsetValue, actor)).toBe(offset);
  }
);

Then(
  '{actor} cannot raise the feed rating offset past {int}',
  async (w, actor: Actor, limit: number) => {
    expect(await w.s.read(readFeedOffsetValue, actor)).toBe(limit);
  }
);

Then(
  '{actor} cannot lower the feed rating offset past {int}',
  async (w, actor: Actor, limit: number) => {
    expect(await w.s.read(readFeedOffsetValue, actor)).toBe(limit);
  }
);

// ------------------------------------------------------ the custom target

Given(
  '{actor} has chosen an unsaved custom feed target raised by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await chooseCustomTarget(w, actor, steps);
  }
);

Given(
  '{actor} has chosen an unsaved custom feed target lowered by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedMode, actor, 'custom');
    await w.s.apply(lowerPuzzleFeedCustomTarget, actor, steps);
  }
);

Given(
  '{actor} has saved a custom feed target raised by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await chooseCustomTarget(w, actor, steps);
    await w.s.apply(closePuzzleFeedSettings, actor);
    await trackPuzzle(w, actor);
  }
);

Given(
  '{actor} has saved a custom feed target raised by {int} step(s) while offline',
  async (w, actor: Actor, steps: number) => {
    await cutConnection(w, actor);
    await chooseCustomTarget(w, actor, steps);
    await w.s.apply(savePuzzleFeedSettings, actor);
  }
);

When(
  '{actor} raises the custom feed target by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(raisePuzzleFeedCustomTarget, actor, steps);
  }
);

When(
  '{actor} lowers the custom feed target by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(lowerPuzzleFeedCustomTarget, actor, steps);
  }
);

Then(
  '{actor} cannot raise the custom feed target past {int}',
  async (w, actor: Actor, limit: number) => {
    expect(await w.s.read(readFeedModalTargetRating, actor)).toBe(limit);
  }
);

Then(
  '{actor} cannot lower the custom feed target past {int}',
  async (w, actor: Actor, limit: number) => {
    expect(await w.s.read(readFeedModalTargetRating, actor)).toBe(limit);
  }
);

// ------------------------------------------------------------ auto-advance

Given(
  '{actor} has chosen unsaved auto-advance after one second',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(
      previewPuzzleFeedChoice,
      actor,
      puzzleGameId(w),
      'after one second'
    );
  }
);

Then(
  "{actor}'s saved feed advances after one second",
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    expect(await w.s.read(readSavedFeedChoice, actor, puzzleGameId(w))).toBe(
      'after one second'
    );
  }
);

Then(
  "{actor}'s unsaved choices cannot replace saved feed choices without saving",
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    expect(await w.s.read(readSavedFeedChoice, actor, puzzleGameId(w))).toBe(
      'own rating'
    );
  }
);

// --------------------------------------------------------------- a theme

Given(
  "the puzzle pool holds puzzles with and without a theme of the game's known puzzle",
  async (w) => {
    const { pool, themed } = themePool(gameOf(w));
    await writePool(w, pool);
    rememberThemed(w, themed);
  }
);

When('{actor} limits the feed to that theme', async (w, actor: Actor) => {
  await limitToTheme(w, actor);
});

Given('{actor} has limited the feed to that theme', async (w, actor: Actor) => {
  await limitToTheme(w, actor);
  await servedPuzzle(w, actor);
});

Then('{actor} is served a puzzle with that theme', async (w, actor: Actor) => {
  await servedPuzzle(w, actor, (id) => themedPuzzles(w).includes(id));
});

Then(
  '{actor} is not offered a puzzle without that theme',
  async (w, actor: Actor) => {
    const id = await servedPuzzle(w, actor);
    expect(themedPuzzles(w)).toContain(id);
  }
);

Then("{actor}'s feed is limited to that theme", async (w, actor: Actor) => {
  await focusPuzzle(w, actor);
  await w.s.until(
    (surf) => isFeedLimitedToTheme(surf, actor, puzzleGameId(w), feedTheme(w)),
    { maxMs: SETTLE_MS }
  );
});

// ------------------------------------------------------- an empty feed

When(
  '{actor} limits the feed to a theme of the game that no puzzle in the pool has',
  async (w, actor: Actor) => {
    const pooled = new Set(
      (gameOf(w).fixtures.puzzles ?? []).flatMap(
        (fixture) =>
          // The pool's themes are its known puzzles' own here.
          fixture.record.themes
      )
    );
    const theme = required(
      gameOf(w).client.puzzles?.themes?.choices.find(
        (choice) => !pooled.has(choice)
      ),
      'a theme of the game no puzzle has'
    );
    await w.s.apply(focusActor, actor);
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, puzzleGameId(w), theme);
    await w.s.apply(closePuzzleFeedSettingsNoWait, actor);
  }
);

Given(
  "{actor} has already played the pool's one puzzle with a theme of the game's known puzzle",
  async (w, actor: Actor) => {
    const theme = feedTheme(w);
    const known = theKnownPuzzle(gameOf(w));
    await writePool(
      w,
      (gameOf(w).fixtures.puzzles ?? []).map((fixture) => ({
        id: fixture.record.id,
        themes: themesWith(
          fixture.record.themes,
          theme,
          fixture.record.id === known.record.id
        ),
      }))
    );
    rememberThemed(w, [known.record.id]);
    // Served it by limiting the feed to the theme, solved, and the feed
    // widened back to every theme.
    // regression: themed-pool-already-current-puzzle
    // solo-count/two-twos may already be the initially served puzzle.
    if ((await w.s.read(readPuzzleOnBoard, actor)) !== known.record.id) {
      await limitToTheme(w, actor);
      await servedPuzzle(w, actor, (id) => id === known.record.id);
    }
    await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(clearPuzzleFeedTheme, actor, puzzleGameId(w), theme);
    await w.s.apply(savePuzzleFeedSettings, actor);
    await trackIfPlaced(w, actor);
  }
);

Given(
  '{actor} has limited the feed to that theme and it is empty',
  async (w, actor: Actor) => {
    await limitToTheme(w, actor);
    // Precondition guard: no puzzle fits it.
    await w.s.until((surf) => isEmptyFeedShown(surf, actor), {
      maxMs: SETTLE_MS,
    });
  }
);

When(
  '{actor} includes puzzles they have already played',
  async (w, actor: Actor) => {
    await w.s.apply(includePlayedPuzzles, actor);
    await trackPuzzle(w, actor);
  }
);

// ---------------------------------------------------------------- "Failed"

Then('{actor} is solving the puzzle they failed', async (w, actor: Actor) => {
  const failed = (w.memo.get(failedPuzzlesKey(actor)) ?? []) as string[];
  const id = await servedPuzzle(w, actor);
  expect(failed).toContain(id);
});

Then(
  '{actor} is told the feed is empty because they have no failed attempts',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isEmptyFeedForNoFailedAttempts(surf, actor), {
      maxMs: SETTLE_MS,
    });
  }
);

// ------------------------------------------------- the other device

Then(
  "{actor}'s other device's feed targets a custom {int} within {int} seconds",
  async (w, actor: Actor, rating: number, seconds: number) => {
    const device = await otherDevicePuzzles(w, actor);
    await untilFeedTarget(
      w,
      device,
      { mode: 'custom', rating },
      seconds * SECOND_MS
    );
  }
);

Then(
  "{actor}'s other device's feed still targets {int} automatically",
  async (w, actor: Actor, rating: number) => {
    const device = await otherDevicePuzzles(w, actor);
    await untilFeedTarget(w, device, { mode: 'auto', rating });
  }
);

Then(
  "{actor}'s other device's feed is limited to that theme within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const device = await otherDevicePuzzles(w, actor);
    await focusPuzzle(w, device);
    await w.s.until(
      (surf) =>
        isFeedLimitedToTheme(surf, device, puzzleGameId(w), feedTheme(w)),
      { maxMs: seconds * SECOND_MS }
    );
  }
);
