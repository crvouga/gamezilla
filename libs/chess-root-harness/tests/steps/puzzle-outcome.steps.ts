/**
 * What an attempt's outcome shows the solver: its rating change (or none),
 * and the puzzle's own rating and themes, hidden until the puzzle is over.
 */

import { expect } from 'bun:test';
import { readServerPuzzles } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { readGameLogRow } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import type { ShownRatingChange } from '@libs/chess-puzzle-harness/puzzle-outcome-reads';
import {
  isPuzzleOwnRatingVisible,
  isPuzzleThemesVisible,
  readShownRatingChange,
} from '@libs/chess-puzzle-harness/puzzle-outcome-reads';
import { Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  currentPuzzle,
  ensureStatsOpen,
  required,
  SETTLE_MS,
} from './puzzle-world';

async function untilRatingChange(
  w: HarnessWorld,
  actor: Actor,
  change: ShownRatingChange
): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => readShownRatingChange(surf, actor), {
    maxMs: SETTLE_MS,
    pred: (shown) => shown === change,
  });
}

Then(
  '{actor} sees a rating change that raised their puzzle rating',
  async (w, actor: Actor) => {
    await untilRatingChange(w, actor, 'raised');
  }
);

Then(
  '{actor} sees a rating change that lowered their puzzle rating',
  async (w, actor: Actor) => {
    await untilRatingChange(w, actor, 'lowered');
  }
);

Then('{actor} sees no rating change', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(readShownRatingChange, actor)).not.toBeOneOf([
    'raised',
    'lowered',
    'unchanged',
  ]);
});

Then("{actor} can see the puzzle's own rating", async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => isPuzzleOwnRatingVisible(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

Then("{actor} cannot see the puzzle's own rating", async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(isPuzzleOwnRatingVisible, actor)).toBe(false);
});

Then("{actor} can see the puzzle's themes", async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.until((surf) => isPuzzleThemesVisible(surf, actor), {
    maxMs: SETTLE_MS,
  });
});

Then("{actor} cannot see the puzzle's themes", async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(isPuzzleThemesVisible, actor)).toBe(false);
});

// ------------------------------------------------------------- game log

Then(
  "{actor}'s game log shows that puzzle's own rating and its rating change",
  async (w, actor: Actor) => {
    const puzzle = currentPuzzle(w, actor);
    const catalog = await w.s.read(readServerPuzzles);
    const own = required(
      catalog.find((row) => row.id === puzzle),
      `puzzle ${puzzle} in the pool`
    ).rating;
    await ensureStatsOpen(w, actor);
    const row = required(
      await w.s.until((surf) => readGameLogRow(surf, actor, puzzle), {
        maxMs: SETTLE_MS,
        pred: (shown) => typeof shown?.change === 'number',
      }),
      `${actor}'s game log row`
    );
    expect(row.puzzleRating).toBe(own);
    expect(row.change).not.toBe(0);
  }
);

Then(
  "{actor}'s game log shows the repeat as unrated",
  async (w, actor: Actor) => {
    const puzzle = currentPuzzle(w, actor);
    await ensureStatsOpen(w, actor);
    await w.s.until((surf) => readGameLogRow(surf, actor, puzzle), {
      maxMs: SETTLE_MS,
      pred: (shown) => shown?.change === 'unrated',
    });
  }
);
