/**
 * Chess's puzzle feed and the pool behind it: an import with broken puzzles
 * and a pass through the feed, solving runs over days, and the feed bar a
 * returning account sees. How every game's feed is customized, chosen and
 * exhausted is the Games context's (`@libs/games-harness` puzzle steps).
 */

import { expect } from 'bun:test';
import { solvePuzzlesDaily } from '@libs/chess-puzzle-harness/chess-actions';
import { ingestChessPuzzleCsv } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import {
  playPuzzleFeedPass,
  readExcludedFeedPassPuzzles,
  readPuzzleFeedPass,
} from '@libs/chess-puzzle-harness/puzzle-feed-pass';
import type { IngestRow } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import {
  FEED_POOL_IDS,
  FULL_INGEST_ROWS,
  ingestCsv,
  STANDARD_PUZZLE_IDS,
} from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { retireCataloguePuzzle } from '@libs/game-session-harness/puzzle-records';
import {
  isEmptyFeedShown,
  isPuzzleUnratedShown,
} from '@libs/game-session-harness/puzzle-screen';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { remember } from '@libs/harness/spec-world';
import { recalled, SERVABLE_KEY, SETTLE_MS, trackPuzzle } from './puzzle-world';

const REJECTED = 'rejectedPuzzles';

// ----------------------------------------------------------- the pool

/** The world's feed-sized pool leaves; the three documented puzzles stay. */
async function retireFeedPool(w: HarnessWorld): Promise<void> {
  for (const id of FEED_POOL_IDS) await w.s.apply(retireCataloguePuzzle, id);
}

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

// ------------------------------------------------------- an exhausted feed

Given(
  '{actor} has solved {int} puzzles a day for {int} days',
  async (w, actor: Actor, perDay: number, days: number) => {
    await w.s.apply(solvePuzzlesDaily, actor, perDay, days);
    await trackPuzzle(w, actor);
  }
);

Then('{actor} is told the attempt is unrated', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => isPuzzleUnratedShown(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

// ------------------------------------------------------------ feed settings

// ------------------------------------------------------------ empty feeds

Then('{actor} is not told the feed is empty', async (w, actor: Actor) => {
  expect(await w.s.read(isEmptyFeedShown, actor)).toBe(false);
});
