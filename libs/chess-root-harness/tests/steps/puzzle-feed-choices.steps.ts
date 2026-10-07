/**
 * Feed choices at their limits and the narrowing ones: the rating offset
 * and custom target stop at their bounds, a chosen theme serves only its
 * puzzles and sticks, and "Failed" serves only failed puzzles.
 */

import { expect } from 'bun:test';
import {
  bumpPuzzleFeedCustomRating,
  closePuzzleFeedSettings,
  lowerPuzzleFeedCustomRating,
  lowerPuzzleFeedOffset,
  openPuzzleByTheme,
  openPuzzleFeedSettings,
  playUntilSolved,
  savePuzzleFeedSettings,
  setPuzzleFeedMode,
  setPuzzleFeedTheme,
} from '@libs/chess-puzzle-harness/chess-actions';
import { readServerPuzzles } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import {
  isFeedLimitedToTheme,
  puzzleThemeNamed,
  readFeedModalTargetRating,
  readFeedOffsetValue,
} from '@libs/chess-puzzle-harness/chess-puzzle-feed-ui';
import {
  isEmptyPoolForNoFailedAttempts,
  readActivePuzzleId,
} from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { GOOD_PUZZLE } from '@libs/chess-puzzle-harness/puzzle-pool-stock';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import { reopenSpaceLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import {
  failedPuzzlesKey,
  recalled,
  required,
  SECOND_MS,
  SETTLE_MS,
  servedPuzzle,
  servedPuzzleId,
  stock,
  trackPuzzle,
} from './puzzle-world';

// ------------------------------------------------------ the rating offset

When(
  '{actor} lowers the feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(lowerPuzzleFeedOffset, actor, steps);
  }
);

Given(
  '{actor} has lowered the unsaved feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(lowerPuzzleFeedOffset, actor, steps);
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

// ---------------------------------------------------- the custom target

When(
  '{actor} raises the custom feed target by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(bumpPuzzleFeedCustomRating, actor, steps);
  }
);

When(
  '{actor} lowers the custom feed target by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(lowerPuzzleFeedCustomRating, actor, steps);
  }
);

Given(
  '{actor} has chosen an unsaved custom feed target lowered by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedMode, actor, 'custom');
    await w.s.apply(lowerPuzzleFeedCustomRating, actor, steps);
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

// ------------------------------------------------------------- a theme

Given(
  'the puzzle pool holds puzzles with and without the {string} theme',
  async (w, name: string) => {
    const theme = puzzleThemeNamed(name);
    await stock(
      w,
      [1480, 1500, 1520].map((rating) => ({
        ...GOOD_PUZZLE,
        rating,
        themes: [theme],
      }))
    );
    // Precondition guard: the pool holds both kinds.
    const withTheme = (await w.s.read(readServerPuzzles)).map((row) =>
      (typeof row.themes === 'string'
        ? row.themes
        : JSON.stringify(row.themes)
      ).includes(`"${theme}"`)
    );
    expect(withTheme).toContain(true);
    expect(withTheme).toContain(false);
  }
);

Given(
  "{actor} has already played the pool's one {string} puzzle",
  async (w, actor: Actor, name: string) => {
    const theme = puzzleThemeNamed(name);
    const [id = ''] = await stock(w, [
      { ...GOOD_PUZZLE, rating: 1250, themes: [theme] },
    ]);
    // Narrow the feed to the theme to be served it, solve it, and widen
    // the feed back to every theme.
    await w.s.apply(openPuzzleByTheme, actor, theme, id);
    await w.s.apply(playUntilSolved, actor);
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, theme);
    await w.s.apply(savePuzzleFeedSettings, actor);
    await trackPuzzle(w, actor);
  }
);

Given(
  '{actor} has limited the feed to the {string} theme',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, puzzleThemeNamed(name));
    await w.s.apply(closePuzzleFeedSettings, actor);
    await trackPuzzle(w, actor);
  }
);

Then(
  '{actor} is served a puzzle with the {string} theme',
  async (w, actor: Actor, name: string) => {
    const theme = puzzleThemeNamed(name);
    await servedPuzzle(w, actor, (debug) => debug.themes.includes(theme));
  }
);

Then(
  '{actor} is not offered a puzzle without the {string} theme',
  async (w, actor: Actor, name: string) => {
    const served = await servedPuzzle(w, actor);
    expect(served.themes).toContain(puzzleThemeNamed(name));
  }
);

Then(
  "{actor}'s feed is limited to the {string} theme",
  async (w, actor: Actor, name: string) => {
    expect(
      await w.s.read(isFeedLimitedToTheme, actor, puzzleThemeNamed(name))
    ).toBe(true);
  }
);

Then(
  "{actor}'s other device's feed is limited to the {string} theme within {int} seconds",
  async (w, actor: Actor, name: string, seconds: number) => {
    const device = otherDevice(actor);
    // The other device looks at the feed in the space the account hosts.
    const link = required(await w.s.read(readSpaceLink, actor), 'a space');
    await w.s.apply(reopenSpaceLink, device, link);
    await w.s.until(
      (surf) => isFeedLimitedToTheme(surf, device, puzzleThemeNamed(name)),
      { maxMs: seconds * SECOND_MS }
    );
  }
);

// ------------------------------------------------------------ "Failed"

When('{actor} saves the feed settings', async (w, actor: Actor) => {
  await w.s.apply(savePuzzleFeedSettings, actor);
  // An empty feed has no puzzle to note.
  if ((await w.s.read(readActivePuzzleId, actor)) !== null) {
    await trackPuzzle(w, actor);
  }
});

Then('{actor} is solving the puzzle they failed', async (w, actor: Actor) => {
  const failed = recalled<readonly string[]>(w, failedPuzzlesKey(actor));
  expect(failed).toContain(await servedPuzzleId(w, actor));
});

Then(
  '{actor} is told the feed is empty because they have no failed attempts',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surf) => isEmptyPoolForNoFailedAttempts(surf, actor), {
      maxMs: SETTLE_MS,
    });
  }
);
