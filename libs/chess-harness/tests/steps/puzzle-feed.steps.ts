/**
 * The puzzle feed and the pool behind it: what the pool holds, how the feed
 * is customized, what it serves (and in what order), and an empty or
 * exhausted feed.
 */

import { expect } from 'bun:test';
import { bumpPuzzleFeedCustomRating, bumpPuzzleFeedOffset, closePuzzleFeedSettings, closePuzzleFeedSettingsNoWait, includePlayedPuzzles, leaveChessStatsScreen, openPuzzleFeedSettings, pressPuzzleNext, returnToPuzzleScreen, setPuzzleFeedHistory, setPuzzleFeedMode, setPuzzleFeedTheme, showChessStatsScreen, solvePuzzlesDaily, solvePuzzlesInARow } from '@libs/chess-puzzle-harness/chess-actions';
import { ingestChessPuzzleCsv, readServerPuzzles, retireChessPuzzle } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { discardFeedSettings, isFeedSignInInviteVisible, puzzleThemeNamed, readFeedHistoryLabel, readFeedModalPool, readFeedModalTargetRating, readFeedOffsetValue, readFeedTargetLabel } from '@libs/chess-puzzle-harness/chess-puzzle-feed-ui';
import type { FeedHistoryFilter } from '@libs/chess-puzzle-harness/chess-puzzle-feed-ui';
import { isEmptyPoolVisible, isPuzzleUnratedNoticeVisible, readActivePuzzleId, readPuzzleDebug, readStatsElo } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { playPuzzleFeedPass, readExcludedFeedPassPuzzles, readPuzzleFeedPass, readPuzzleFeedPassOrder } from '@libs/chess-puzzle-harness/puzzle-feed-pass';
import { FEED_POOL_IDS, FULL_INGEST_ROWS, ingestCsv, SELECTION_CSV, SELECTION_GROUPS, STANDARD_PUZZLE_IDS } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import type { IngestRow } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { focusActor } from '@libs/harness/shell-actions';
import type { Actor } from '@libs/harness/parameter-types';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { otherDevice } from '@libs/harness/platform';
import { remember } from '@libs/harness/spec-world';
import {
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import {
  currentPuzzle,
  ensureStatsOpen,
  lastPlayer,
  recalled,
  required,
  SECOND_MS,
  SERVABLE_KEY,
  SETTLE_MS,
  trackPuzzle,
} from './puzzle-world';

const REJECTED = 'rejectedPuzzles';
const LOW_QUALITY = 'lowQualityPuzzles';
const IN_WINDOW = 'inWindowPuzzles';
const OUT_OF_WINDOW = 'outOfWindowPuzzles';
const firstPlayedKey = (actor: Actor) => `firstPlayed:${actor}`;
const ratingBeforeRepeatKey = (actor: Actor) => `ratingBeforeRepeat:${actor}`;

function historyFilter(label: string): FeedHistoryFilter {
  const filters: Partial<Record<string, FeedHistoryFilter>> = {
    Any: 'any',
    Unseen: 'neverSeen',
    Seen: 'seen',
    Failed: 'failed',
  };
  const filter = filters[label];
  if (filter === undefined) throw new Error(`no history filter "${label}"`);
  return filter;
}

async function untilFeedTarget(
  w: HarnessWorld,
  actor: Actor,
  mode: 'auto' | 'custom',
  rating: number
): Promise<void> {
  await w.s.until(async (surf) => readFeedTargetLabel(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (label) => label?.mode === mode && label.rating === rating,
  });
}

/** Solve `count` puzzles in a row, noting the first as "the first played". */
async function solveInARow(w: HarnessWorld, actor: Actor, count: number) {
  remember(w, firstPlayedKey(actor), currentPuzzle(w, actor));
  await w.s.apply(solvePuzzlesInARow, actor, count);
  await trackPuzzle(w, actor);
}

/** Wait until the feed serves the first puzzle the actor played. */
async function untilFirstPlayedComesRound(
  w: HarnessWorld,
  actor: Actor,
  maxMs: number
): Promise<void> {
  const first = recalled<string>(w, firstPlayedKey(actor));
  await w.s.until(async (surf) => readActivePuzzleId(surf, actor), {
    maxMs,
    pred: (id) => id === first,
  });
  await trackPuzzle(w, actor);
}

// ----------------------------------------------------------- the pool

/** The world's feed-sized pool leaves; the three documented puzzles stay. */
async function retireFeedPool(w: HarnessWorld): Promise<void> {
  for (const id of FEED_POOL_IDS) await w.s.apply(retireChessPuzzle, id);
}

Given('the puzzle pool holds just three puzzles', async (w) => {
  await retireFeedPool(w);
  const pool = (await w.s.read(readServerPuzzles)).map((row) => row.id);
  expect(pool).toEqual([...STANDARD_PUZZLE_IDS]);
});

Given(
  'the puzzle pool also holds:',
  async (w, table: readonly (readonly string[])[]) => {
    const [header, ...rows] = table;
    expect(header).toEqual(['puzzles', 'rated', 'quality']);
    // The table names fixture groups; each must match one exactly.
    const groups = rows.map(([count, rated, quality]) => {
      const group = Object.values(SELECTION_GROUPS).find(
        (g) => g.rated === rated && g.quality === quality
      );
      if (group?.ids.length !== Number(count)) {
        throw new Error(`no ${count ?? ''} fixture puzzles ${rated ?? ''}`);
      }
      return group;
    });
    expect(new Set(groups).size).toBe(Object.keys(SELECTION_GROUPS).length);
    await w.s.apply(ingestChessPuzzleCsv, SELECTION_CSV);
    remember(w, IN_WINDOW, SELECTION_GROUPS.goodNear1500.ids);
    remember(w, OUT_OF_WINDOW, SELECTION_GROUPS.good1800To1900.ids);
    remember(w, LOW_QUALITY, SELECTION_GROUPS.lowQuality.ids);
    remember(w, SERVABLE_KEY, [
      ...SELECTION_GROUPS.goodNear1500.ids,
      ...SELECTION_GROUPS.good1800To1900.ids,
      ...STANDARD_PUZZLE_IDS,
      ...FEED_POOL_IDS,
    ]);
  }
);

Given('the team has added seven puzzles, five of them broken', async (w) => {
  const valid = FULL_INGEST_ROWS.filter((row) => row.valid);
  const rejected = FULL_INGEST_ROWS.filter((row) => !row.valid);
  if (valid.length !== 2 || rejected.length !== 5) {
    throw new Error('the added puzzles are not two good and five broken');
  }
  // The import beside the three documented puzzles, so a pass through
  // the feed stays within a guest's day and reaches every import.
  await retireFeedPool(w);
  await w.s.apply(ingestChessPuzzleCsv, ingestCsv(FULL_INGEST_ROWS));
  remember(
    w,
    REJECTED,
    rejected.map((row: IngestRow) => row.id)
  );
  remember(w, SERVABLE_KEY, [
    ...STANDARD_PUZZLE_IDS,
    ...valid.map((row) => row.id),
  ]);
});

// ------------------------------------------------- passes through the feed

When(
  '{actor} plays through every puzzle the feed offers',
  async (w, actor: Actor) => {
    const servable = recalled<readonly string[]>(w, SERVABLE_KEY);
    await w.s.apply(playPuzzleFeedPass, actor, servable);
    await trackPuzzle(w, actor);
  }
);

Then(
  'none of the low-quality puzzles was served to {actor}',
  async (w, actor: Actor) => {
    const ids = await w.s.read(readPuzzleFeedPass, actor);
    expect(ids.length).toBeGreaterThan(0);
    expect(
      await w.s.read(
        readExcludedFeedPassPuzzles,
        actor,
        recalled<readonly string[]>(w, LOW_QUALITY)
      )
    ).toEqual([]);
  }
);

Then(
  'none of the broken puzzles was served to {actor}',
  async (w, actor: Actor) => {
    const ids = await w.s.read(readPuzzleFeedPass, actor);
    expect(ids.length).toBeGreaterThan(0);
    expect(
      await w.s.read(
        readExcludedFeedPassPuzzles,
        actor,
        recalled<readonly string[]>(w, REJECTED)
      )
    ).toEqual([]);
  }
);

Then(
  'every good puzzle near 1500 was served before any puzzle rated 1800 to 1900',
  async (w) => {
    const inWindow = recalled<readonly string[]>(w, IN_WINDOW);
    const outOfWindow = recalled<readonly string[]>(w, OUT_OF_WINDOW);
    const order = await w.s.read(readPuzzleFeedPassOrder, lastPlayer(w), {
      near: inWindow,
      far: outOfWindow,
    });
    expect(order.allNearPresent).toBe(true);
    expect(order.allFarPresent).toBe(true);
    expect(order.lastNear).toBeLessThan(order.firstFar);
  }
);

// ------------------------------------------------------- an exhausted feed

Given(
  '{actor} has solved {int} puzzles in a row',
  async (w, actor: Actor, count: number) => {
    await solveInARow(w, actor, count);
  }
);

Given(
  '{actor} has solved {int} puzzles a day for {int} days',
  async (w, actor: Actor, perDay: number, days: number) => {
    await w.s.apply(solvePuzzlesDaily, actor, perDay, days);
    await trackPuzzle(w, actor);
  }
);

Given(
  "{actor}'s feed has come round to a puzzle they already played",
  async (w, actor: Actor) => {
    await w.s.apply(pressPuzzleNext, actor);
    await untilFirstPlayedComesRound(w, actor, SETTLE_MS);
    // The rating before the repeat, as the stats show it.
    await w.s.apply(showChessStatsScreen, actor);
    remember(
      w,
      ratingBeforeRepeatKey(actor),
      required(await w.s.read(readStatsElo, actor), `${actor}'s rating`)
    );
    await w.s.apply(leaveChessStatsScreen, actor);
    await w.s.apply(returnToPuzzleScreen, actor);
  }
);
Then(
  "{actor}'s feed comes round to the first puzzle they played within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await untilFirstPlayedComesRound(w, actor, seconds * SECOND_MS);
  }
);

Then('{actor} is told the attempt is unrated', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => isPuzzleUnratedNoticeVisible(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

Then(
  "{actor}'s puzzle rating is still unchanged by the repeat because that puzzle is already rated",
  async (w, actor: Actor) => {
    await ensureStatsOpen(w, actor);
    expect(await w.s.read(readStatsElo, actor)).toBe(
      recalled<number>(w, ratingBeforeRepeatKey(actor))
    );
  }
);

// ------------------------------------------------------------ feed settings

Then(
  "{actor}'s feed history shows {string}",
  async (w, actor: Actor, label: string) => {
    expect(await w.s.read(readFeedHistoryLabel, actor)).toBe(label);
  }
);

/** Open the settings, pick the history filter labelled `label`, and save. */
async function saveHistoryFilter(w: HarnessWorld, actor: Actor, label: string) {
  await w.s.apply(openPuzzleFeedSettings, actor);
  await w.s.apply(setPuzzleFeedHistory, actor, historyFilter(label));
  await w.s.apply(closePuzzleFeedSettings, actor);
  await trackPuzzle(w, actor);
}

Given(
  '{actor} has chosen {string} for the unsaved feed history',
  async (w, actor: Actor, label: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedHistory, actor, historyFilter(label));
  }
);

When('{actor} saves the feed settings', async (w, actor: Actor) => {
  await w.s.apply(closePuzzleFeedSettings, actor);
  await trackPuzzle(w, actor);
});

Given(
  '{actor} has changed the feed history to {string} and saved the feed settings',
  async (w, actor: Actor, label: string) => {
    await saveHistoryFilter(w, actor, label);
  }
);

Then(
  "{actor}'s feed targets {int} automatically",
  async (w, actor: Actor, rating: number) => {
    await untilFeedTarget(w, actor, 'auto', rating);
  }
);

When(
  '{actor} closes the feed settings without saving',
  async (w, actor: Actor) => {
    await w.s.apply(discardFeedSettings, actor);
  }
);

Then(
  "{actor}'s feed targets a custom {int}",
  async (w, actor: Actor, rating: number) => {
    await untilFeedTarget(w, actor, 'custom', rating);
  }
);

Then(
  "{actor}'s other device's feed targets a custom {int} within {int} seconds",
  async (w, actor: Actor, rating: number, seconds: number) => {
    const device = otherDevice(actor);
    // The other device looks at the feed in the space the account hosts.
    const link = required(await w.s.read(readSpaceLink, actor), 'a space');
    await w.s.apply(openSpaceLink, device, link);
    await w.s.apply(joinFromPrompt, device);
    await w.s.until(async (surf) => readFeedTargetLabel(surf, device), {
      maxMs: seconds * SECOND_MS,
      pred: (label) => label?.mode === 'custom' && label.rating === rating,
    });
  }
);

Given('{actor} is editing the feed settings', async (w, actor: Actor) => {
  await w.s.apply(openPuzzleFeedSettings, actor);
});

When('{actor} starts editing the feed settings', async (w, actor: Actor) => {
  await w.s.apply(openPuzzleFeedSettings, actor);
});

Then(
  '{actor} cannot customize the feed without an account',
  async (w, actor: Actor) => {
    expect(await w.s.read(isFeedSignInInviteVisible, actor)).toBe(true);
  }
);

Then(
  "{actor}'s feed rating offset is {int}",
  async (w, actor: Actor, offset: number) => {
    expect(await w.s.read(readFeedOffsetValue, actor)).toBe(offset);
  }
);

When(
  '{actor} raises the feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(bumpPuzzleFeedOffset, actor, steps);
  }
);

Given(
  '{actor} has raised the unsaved feed rating offset by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(bumpPuzzleFeedOffset, actor, steps);
  }
);

Then(
  "{actor}'s unsaved feed settings preview a target of {int}",
  async (w, actor: Actor, rating: number) => {
    expect(await w.s.read(readFeedModalTargetRating, actor)).toBe(rating);
  }
);

/** Open the settings, switch to a custom target `steps` up, and save. */
async function saveCustomTarget(w: HarnessWorld, actor: Actor, steps: number) {
  await w.s.apply(openPuzzleFeedSettings, actor);
  await w.s.apply(setPuzzleFeedMode, actor, 'custom');
  await w.s.apply(bumpPuzzleFeedCustomRating, actor, steps);
  await w.s.apply(closePuzzleFeedSettings, actor);
  await trackPuzzle(w, actor);
}

Given(
  '{actor} has chosen an unsaved custom feed target raised by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedMode, actor, 'custom');
    await w.s.apply(bumpPuzzleFeedCustomRating, actor, steps);
  }
);

Given(
  '{actor} has saved a custom feed target raised by {int} step(s)',
  async (w, actor: Actor, steps: number) => {
    await saveCustomTarget(w, actor, steps);
  }
);

Then(
  "{actor}'s feed settings show a pool of at least one matching puzzle",
  async (w, actor: Actor) => {
    const pool = required(await w.s.read(readFeedModalPool, actor), 'pool');
    expect(pool.matched).toBeGreaterThan(0);
  }
);

Then(
  '{actor} is solving a puzzle rated between {int} and {int}',
  async (w, actor: Actor, low: number, high: number) => {
    const debug = required(await w.s.read(readPuzzleDebug, actor), 'puzzle');
    expect(debug.status).toBe('solving');
    const rating = required(debug.puzzleRating, 'puzzle rating');
    expect(rating).toBeGreaterThanOrEqual(low);
    expect(rating).toBeLessThanOrEqual(high);
  }
);

// ------------------------------------------------------------ empty feeds

When(
  '{actor} limits the feed to the {string} theme',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, puzzleThemeNamed(name));
    await w.s.apply(closePuzzleFeedSettingsNoWait, actor);
  }
);

Given(
  '{actor} has limited the feed to the {string} theme and it is empty',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedTheme, actor, puzzleThemeNamed(name));
    await w.s.apply(closePuzzleFeedSettingsNoWait, actor);
    // Precondition guard: the filter really matches nothing.
    await w.s.until((surf) => isEmptyPoolVisible(surf, actor), {
      maxMs: SETTLE_MS,
    });
  }
);

Then(
  '{actor} is told the feed is empty within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => isEmptyPoolVisible(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then('{actor} is not told the feed is empty', async (w, actor: Actor) => {
  expect(await w.s.read(isEmptyPoolVisible, actor)).toBe(false);
});

When(
  '{actor} includes puzzles they have already played',
  async (w, actor: Actor) => {
    await w.s.apply(includePlayedPuzzles, actor);
    await trackPuzzle(w, actor);
  }
);
