/**
 * What a chess puzzle's game log row shows: the puzzle's own rating and its
 * rating change, or that a repeat was unrated. What every game's attempt
 * shows is the Games context's (`@libs/games-harness` puzzle steps).
 */

import { expect } from 'bun:test';
import { readServerPuzzles } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { readGameLogRow } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import {
  currentPuzzle,
  ensureStatsOpen,
  required,
  SETTLE_MS,
} from './puzzle-world';

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
